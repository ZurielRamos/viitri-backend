import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthService, type AuthResponse } from '../auth/auth.service.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import {
  TEAM_PROFILE_LIMITS,
  effectivePlan,
  planDefinition,
} from '../businesses/plans/plans.js';
import { isUniqueViolation } from '../common/database-errors.js';
import { TTL_STORE, type TtlStore } from '../common/ttl-store/ttl-store.js';
import { User } from '../users/entities/user.entity.js';
import type {
  CreateTeamProfileDto,
  TeamLoginDto,
  UpdateTeamProfileDto,
} from './dto/team.dto.js';

/** Un perfil del equipo, como lo ve el dueño. */
export interface TeamProfile {
  id: string;
  name: string;
  /** Encargado: también cambia el menú y los ajustes. */
  manager: boolean;
  /** Recibe las notificaciones push de pedidos y reservas. */
  notifyOrders: boolean;
  createdAt: Date;
}

/**
 * PIN equivocados que admite cada negocio por hora. Desde el enlace del
 * equipo (con su clave) el cupo es aparte y más amplio: así, si alguien prueba
 * PIN desde la tienda pública, quien ya abrió el enlace no se queda afuera.
 */
const FAILURES_PER_HOUR = { open: 10, link: 30 } as const;
const WINDOW_SECONDS = 60 * 60;
const WRONG_PIN = 'PIN incorrecto.';
const PIN_TAKEN =
  'Ese PIN ya lo usa otra persona del equipo. Elige otro (o toca el botón para uno al azar).';
const PAUSED_OPEN =
  'Hubo muchos PIN equivocados. Por seguridad, entra con el enlace del equipo o espera un rato.';
const PAUSED_LINK =
  'Hubo muchos PIN equivocados. Espera un rato y vuelve a intentarlo.';
const LINK_NOT_FOUND =
  'Este enlace ya no sirve. Pídele el nuevo al dueño del negocio.';

const roleFor = (manager?: boolean) =>
  manager ? BusinessRole.Admin : BusinessRole.Staff;

/**
 * Equipo con PIN. Cada perfil es un usuario sin correo ni celular que solo
 * pertenece a un negocio. Entra solo con su PIN, que por eso es único en el
 * negocio: no se muestran los nombres del equipo a nadie.
 */
@Injectable()
export class TeamService {
  private readonly pinSecret: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    @Inject(TTL_STORE) private readonly ttl: TtlStore,
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {
    this.pinSecret = config.getOrThrow<string>('JWT_SECRET');
  }

  /** Clave del enlace (se crea la primera vez) y los perfiles. */
  /** Clave del enlace (se crea la primera vez), los perfiles y cuántos permite el plan vigente. */
  async overview(
    businessId: string,
  ): Promise<{ key: string; profiles: TeamProfile[]; limit: number | null }> {
    const business = await this.businesses.findOneByOrFail({ id: businessId });
    return {
      key: await this.ensureKey(businessId),
      profiles: await this.list(businessId),
      limit: TEAM_PROFILE_LIMITS
        ? planDefinition(effectivePlan(business)).maxTeamProfiles
        : null,
    };
  }

  async create(
    businessId: string,
    dto: CreateTeamProfileDto,
  ): Promise<TeamProfile> {
    try {
      const userId = await this.dataSource.transaction(async (manager) => {
        const business = await manager.findOne(Business, {
          where: { id: businessId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!business) throw new NotFoundException('Negocio no encontrado.');
        if (TEAM_PROFILE_LIMITS) {
          // Solo cuentan los colaboradores con PIN, según el plan vigente.
          const plan = planDefinition(effectivePlan(business));
          const used = await manager.countBy(User, {
            teamBusinessId: businessId,
          });
          if (used >= plan.maxTeamProfiles) {
            throw new BadRequestException(
              plan.maxTeamProfiles === 0
                ? 'En el plan Básico solo entras tú. Con Avanzado puedes sumar hasta 4 colaboradores con PIN.'
                : `Tu plan ${plan.name} permite hasta ${plan.maxTeamProfiles} colaboradores con PIN.`,
            );
          }
        }
        await this.assertNameFree(
          manager.getRepository(User),
          businessId,
          dto.name,
        );
        const user = await manager.save(
          manager.create(User, {
            email: null,
            name: dto.name,
            passwordHash: null,
            teamBusinessId: businessId,
            pinLookup: this.pinLookup(businessId, dto.pin),
            // No ve la bienvenida de los dueños.
            onboardedAt: new Date(),
          }),
        );
        await manager.save(
          manager.create(BusinessMember, {
            businessId,
            userId: user.id,
            role: roleFor(dto.manager),
            notifyOrders: dto.notifyOrders ?? true,
          }),
        );
        return user.id;
      });
      return this.findOrFail(businessId, userId);
    } catch (error) {
      throw pinConflict(error);
    }
  }

  async update(
    businessId: string,
    profileId: string,
    dto: UpdateTeamProfileDto,
  ): Promise<TeamProfile> {
    const profile = await this.findOrFail(businessId, profileId);
    if (dto.name !== undefined && dto.name !== profile.name) {
      await this.assertNameFree(this.users, businessId, dto.name, profileId);
      await this.users.update(profileId, { name: dto.name });
    }
    if (dto.pin !== undefined) {
      // PIN nuevo: se cierran las sesiones abiertas con el anterior.
      try {
        await this.users.update(profileId, {
          pinLookup: this.pinLookup(businessId, dto.pin),
        });
      } catch (error) {
        throw pinConflict(error);
      }
      await this.users.increment({ id: profileId }, 'sessionVersion', 1);
    }
    if (dto.manager !== undefined && dto.manager !== profile.manager) {
      await this.members.update(
        { businessId, userId: profileId },
        { role: roleFor(dto.manager) },
      );
    }
    if (
      dto.notifyOrders !== undefined &&
      dto.notifyOrders !== profile.notifyOrders
    ) {
      await this.members.update(
        { businessId, userId: profileId },
        { notifyOrders: dto.notifyOrders },
      );
    }
    return this.findOrFail(businessId, profileId);
  }

  /** Lo borra del todo: sus sesiones dejan de servir de inmediato. */
  async remove(businessId: string, profileId: string): Promise<void> {
    await this.findOrFail(businessId, profileId);
    await this.users.delete({ id: profileId, teamBusinessId: businessId });
  }

  /** Enlace nuevo: el anterior deja de servir. Las sesiones abiertas siguen. */
  async regenerateKey(businessId: string): Promise<{ key: string }> {
    const key = newKey();
    await this.businesses.update(businessId, { teamKey: key });
    return { key };
  }

  /**
   * Entra solo con el PIN. Con `key` (el enlace del equipo) una clave
   * equivocada da 404; sin ella, desde la hoja "Entrar" de la tienda.
   */
  async login(
    slug: string,
    key: string | null,
    dto: TeamLoginDto,
  ): Promise<AuthResponse> {
    const business = await this.findBusiness(slug, key);
    // Sin colaboradores en el plan vigente (Básico, o una prueba vencida).
    if (
      TEAM_PROFILE_LIMITS &&
      planDefinition(effectivePlan(business)).maxTeamProfiles === 0
    ) {
      throw new ForbiddenException(
        'El plan de este negocio no incluye colaboradores. Pídele al dueño que lo active.',
      );
    }
    const via = key ? 'link' : 'open';
    const counter = `team-pin-failures:${via}:${business.id}`;
    if ((await this.failures(counter)) >= FAILURES_PER_HOUR[via]) {
      throw new HttpException(
        via === 'open' ? PAUSED_OPEN : PAUSED_LINK,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.users.findOne({
      where: {
        teamBusinessId: business.id,
        pinLookup: this.pinLookup(business.id, dto.pin),
      },
    });
    if (!user) {
      await this.countFailure(counter);
      throw new UnauthorizedException(WRONG_PIN);
    }
    return this.auth.issueTeamToken(user);
  }

  /**
   * HMAC del PIN con el negocio y el secreto del servidor: el mismo PIN da
   * otro valor en cada negocio, y sin el secreto no se puede probar.
   */
  private pinLookup(businessId: string, pin: string): string {
    return createHmac('sha256', this.pinSecret)
      .update(`team-pin:${businessId}:${pin}`)
      .digest('hex');
  }

  private failures(key: string): Promise<number> {
    return this.ttl.mutate<number, number>(key, (current) => ({
      result: current ?? 0,
    }));
  }

  private async countFailure(key: string): Promise<void> {
    await this.ttl.setIfAbsent(key, 0, WINDOW_SECONDS);
    await this.ttl.mutate<number, void>(key, (current) => ({
      value: (current ?? 0) + 1,
      result: undefined,
    }));
  }

  private async list(businessId: string): Promise<TeamProfile[]> {
    const members = await this.members
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .where('member.businessId = :businessId', { businessId })
      .andWhere('user.teamBusinessId = :businessId', { businessId })
      .orderBy('user.name', 'ASC')
      .getMany();
    return members.map((member) => ({
      id: member.userId,
      name: member.user.name,
      manager: member.role === BusinessRole.Admin,
      notifyOrders: member.notifyOrders,
      createdAt: member.user.createdAt,
    }));
  }

  private async findOrFail(
    businessId: string,
    profileId: string,
  ): Promise<TeamProfile> {
    const profile = (await this.list(businessId)).find(
      (p) => p.id === profileId,
    );
    if (!profile) {
      throw new NotFoundException('Esta persona ya no está en el equipo.');
    }
    return profile;
  }

  /** Dos personas con el mismo nombre se confunden en los pedidos. */
  private async assertNameFree(
    users: Repository<User>,
    businessId: string,
    name: string,
    exceptId?: string,
  ) {
    const taken = await users
      .createQueryBuilder('user')
      .where('user.teamBusinessId = :businessId', { businessId })
      .andWhere('lower(user.name) = lower(:name)', { name })
      .andWhere(exceptId ? 'user.id <> :exceptId' : 'TRUE', { exceptId })
      .getExists();
    if (taken) {
      throw new BadRequestException(
        'Ya hay alguien con ese nombre en el equipo. Usa otro (por ejemplo, con el apellido).',
      );
    }
  }

  private async ensureKey(businessId: string): Promise<string> {
    const current = await this.readKey(businessId);
    if (current) return current;
    // Si dos pestañas la crean a la vez, queda la primera.
    await this.businesses
      .createQueryBuilder()
      .update()
      .set({ teamKey: newKey() })
      .where('id = :businessId AND team_key IS NULL', { businessId })
      .execute();
    const key = await this.readKey(businessId);
    if (!key) throw new NotFoundException('Negocio no encontrado.');
    return key;
  }

  private async readKey(businessId: string): Promise<string | null> {
    const business = await this.businesses
      .createQueryBuilder('business')
      .addSelect('business.teamKey')
      .where('business.id = :businessId', { businessId })
      .getOne();
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business.teamKey;
  }

  private async findBusiness(
    slug: string,
    key: string | null,
  ): Promise<Business> {
    if (key !== null && !/^[A-Za-z0-9_-]{8,32}$/.test(key)) {
      throw new NotFoundException(LINK_NOT_FOUND);
    }
    const query = this.businesses
      .createQueryBuilder('business')
      .where('business.slug = :slug', { slug });
    if (key !== null) query.andWhere('business.teamKey = :key', { key });
    const business = await query.getOne();
    if (!business) {
      throw new NotFoundException(
        key === null ? 'Negocio no encontrado.' : LINK_NOT_FOUND,
      );
    }
    return business;
  }
}

/** 12 caracteres aleatorios, cortos para que el enlace quepa en un QR simple. */
function newKey(): string {
  return randomBytes(9).toString('base64url');
}

/** El índice único del PIN en el negocio, como un mensaje para el dueño. */
function pinConflict(error: unknown): unknown {
  if (!isUniqueViolation(error)) return error;
  const constraint = (error as { driverError?: { constraint?: string } })
    .driverError?.constraint;
  return constraint === 'uq_users_team_pin'
    ? new BadRequestException(PIN_TAKEN)
    : error;
}
