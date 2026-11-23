import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UsersService } from '../users/users.service.js';
import type { CreateBusinessDto } from './dto/create-business.dto.js';
import type { UpdateBusinessDto } from './dto/update-business.dto.js';
import { BusinessMember } from './entities/business-member.entity.js';
import { BusinessProfile } from './entities/business-profile.entity.js';
import { Business } from './entities/business.entity.js';
import { BusinessRole } from './business-role.enum.js';
import { regionDefaultsForPhone } from './profile/region-defaults.js';
import {
  FREE_BUSINESS_USED_MESSAGE,
  DEFAULT_PLAN,
  PLAN_FEATURE_LIMITS,
  TRIAL_DAYS,
  planDefinition,
  planIncludes,
  planStatus,
  type Plan,
} from './plans/plans.js';
import { featureDefinition } from './catalog-features/feature-catalog.js';
import {
  BUSINESS_TYPE_PRESETS,
  featureSetError,
  isBusinessTypeAvailable,
} from './catalog-features/feature-catalog.js';

export type BusinessWithRole = Pick<
  Business,
  | 'id'
  | 'name'
  | 'slug'
  | 'features'
  | 'plan'
  | 'freeBasic'
  | 'businessType'
  | 'createdAt'
  | 'updatedAt'
  | 'trialEndsAt'
  | 'paidUntil'
> &
  ReturnType<typeof planStatus> & {
    /** Rol del usuario actual en el negocio. */
    role: BusinessRole;
  };

const trialEnd = (from = new Date()) =>
  new Date(from.getTime() + TRIAL_DAYS * 86_400_000);

const SLUG_TAKEN = 'El slug ya está en uso.';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
    private readonly users: UsersService,
  ) {}

  /** Crea el negocio y su owner en una sola transacción. */
  async create(actor: User, dto: CreateBusinessDto): Promise<Business> {
    let owner = actor;
    if (dto.ownerEmail) {
      if (actor.platformRole !== PlatformRole.SuperAdmin) {
        throw new ForbiddenException(
          'Solo un super_admin puede crear negocios para otro usuario.',
        );
      }
      const found = await this.users.findByEmail(dto.ownerEmail);
      if (!found) {
        throw new BadRequestException('El owner indicado no está registrado.');
      }
      owner = found;
    }

    if (dto.businessType && !isBusinessTypeAvailable(dto.businessType)) {
      throw new BadRequestException(
        'Ese tipo de negocio estará disponible pronto.',
      );
    }
    // Sin funcionalidades explícitas, el negocio nace con la básica de su tipo.
    const features =
      dto.features ??
      (dto.businessType ? BUSINESS_TYPE_PRESETS[dto.businessType].enabled : []);
    // Básico, o Avanzado y Pro con su prueba gratis.
    const plan = dto.plan ?? DEFAULT_PLAN;
    const featureError = featureSetError(features, plan);
    if (featureError) throw new BadRequestException(featureError);

    await this.assertSlugAvailable(dto.slug);

    try {
      return await this.dataSource.transaction(async (manager) => {
        // El primer negocio de cada usuario es gratis en Básico; los demás
        // Por ahora, un solo negocio por cuenta (el código admite varios).
        // El bloqueo por usuario evita que dos peticiones usen el mismo cupo.
        // El super_admin puede crearlos igual (sin costo cero) para dar soporte.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `free-business:${owner.id}`,
        ]);
        const [{ claimed }] = await manager.query<{ claimed: Date | null }[]>(
          'SELECT free_business_claimed_at AS claimed FROM users WHERE id = $1',
          [owner.id],
        );
        const freeBasic = claimed === null;
        if (!freeBasic && actor.platformRole !== PlatformRole.SuperAdmin) {
          throw new ForbiddenException(FREE_BUSINESS_USED_MESSAGE);
        }
        if (freeBasic) {
          await manager.update(User, owner.id, {
            freeBusinessClaimedAt: new Date(),
          });
        }

        const business = await manager.save(
          manager.create(Business, {
            name: dto.name.trim(),
            slug: dto.slug,
            features,
            businessType: dto.businessType ?? null,
            freeBasic,
            plan,
            trialEndsAt: plan === 'basic' ? null : trialEnd(),
          }),
        );
        await manager.save(
          manager.create(BusinessMember, {
            businessId: business.id,
            userId: owner.id,
            role: BusinessRole.Owner,
          }),
        );
        // Moneda y zona horaria según el país del WhatsApp del propietario.
        await manager.save(
          manager.create(BusinessProfile, {
            businessId: business.id,
            ...regionDefaultsForPhone(owner.phone),
          }),
        );
        return business;
      });
    } catch (error) {
      // Carrera: otro request tomó el slug entre la verificación y el insert.
      if (isUniqueViolation(error)) throw new ConflictException(SLUG_TAKEN);
      throw error;
    }
  }

  async update(businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.findByIdOrFail(businessId);

    if (dto.slug !== undefined && dto.slug !== business.slug) {
      await this.assertSlugAvailable(dto.slug, business.id);
      business.slug = dto.slug;
    }
    if (dto.name !== undefined) business.name = dto.name.trim();

    try {
      return await this.businesses.save(business);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(SLUG_TAKEN);
      throw error;
    }
  }

  async isSlugAvailable(slug: string, excludeBusinessId?: string) {
    const exists = await this.businesses.exists({
      where: {
        slug,
        ...(excludeBusinessId ? { id: Not(excludeBusinessId) } : {}),
      },
    });
    return !exists;
  }

  private async assertSlugAvailable(slug: string, excludeBusinessId?: string) {
    if (!(await this.isSlugAvailable(slug, excludeBusinessId))) {
      throw new ConflictException(SLUG_TAKEN);
    }
  }

  /** Negocios a las que el usuario tiene acceso, con su rol en cada una. */
  async findForUser(userId: string): Promise<BusinessWithRole[]> {
    const memberships = await this.members.find({
      where: { userId },
      relations: { business: true },
      order: { business: { name: 'ASC' } },
    });
    return memberships.map(({ business, role }) => ({
      id: business.id,
      name: business.name,
      slug: business.slug,
      features: business.features,
      plan: business.plan,
      freeBasic: business.freeBasic,
      businessType: business.businessType,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      trialEndsAt: business.trialEndsAt,
      paidUntil: business.paidUntil,
      ...planStatus(business),
      role,
    }));
  }

  /**
   * El dueño prueba Avanzado o Pro gratis. La prueba es una sola por
   * negocio: después, el plan se paga (por ahora lo marca el super admin).
   */
  async startTrial(id: string, plan: Plan): Promise<Business> {
    if (plan === 'basic') {
      throw new BadRequestException('El plan Básico no tiene prueba.');
    }
    const business = await this.findByIdOrFail(id);
    if (business.trialEndsAt) {
      throw new BadRequestException(
        `Ya usaste la prueba gratis. Para seguir con ${planDefinition(plan).name}, escríbenos y activamos tu plan.`,
      );
    }
    business.plan = plan;
    business.trialEndsAt = trialEnd();
    return this.businesses.save(business);
  }

  /** Lo marca el super admin al recibir el pago (no hay cobro en línea). */
  async setPaidUntil(id: string, paidUntil: Date | null): Promise<Business> {
    const business = await this.findByIdOrFail(id);
    business.paidUntil = paidUntil;
    return this.businesses.save(business);
  }

  /**
   * Cambia el plan. Al bajar, apaga las funcionalidades que el nuevo plan no
   * incluye; sus datos se conservan. El equipo no se toca: si supera el
   * límite, solo deja de poder invitar.
   */
  async changePlan(id: string, plan: Plan): Promise<Business> {
    const business = await this.findByIdOrFail(id);
    business.plan = plan;
    business.features = business.features.filter(
      (f) =>
        !PLAN_FEATURE_LIMITS || planIncludes(plan, featureDefinition(f).tier),
    );
    return this.businesses.save(business);
  }

  findById(id: string): Promise<Business | null> {
    return this.businesses.findOneBy({ id });
  }

  async findByIdOrFail(id: string): Promise<Business> {
    const business = await this.findById(id);
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business;
  }

  /** Incluye el perfil (moneda, ubicación, horarios). */
  async findByIdWithProfileOrFail(id: string): Promise<Business> {
    const business = await this.businesses.findOne({
      where: { id },
      relations: { profile: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business;
  }

  /** Incluye el perfil. Pensado para la vista pública. */
  async findBySlugOrFail(slug: string): Promise<Business> {
    const business = await this.businesses.findOne({
      where: { slug: slug.toLowerCase() },
      relations: { profile: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business;
  }

  findAll(options: {
    skip: number;
    take: number;
  }): Promise<[Business[], number]> {
    return this.businesses.findAndCount({
      order: { createdAt: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
  }

  findMembership(businessId: string, userId: string) {
    return this.members.findOneBy({ businessId, userId });
  }
}
