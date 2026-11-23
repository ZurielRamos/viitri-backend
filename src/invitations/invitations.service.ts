import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, MoreThan, Not, Repository } from 'typeorm';
import { NotificationChannel } from '../notifications/notification-channel.enum.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { planDefinition } from '../businesses/plans/plans.js';
import type { BusinessActor } from '../businesses/business-members.service.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UsersService } from '../users/users.service.js';
import type { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { BusinessInvitation } from './entities/business-invitation.entity.js';
import { InvitationStatus } from './invitation-status.enum.js';

const INVALID_INVITATION = 'La invitación no es válida o ya expiró.';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BusinessInvitation)
    private readonly invitations: Repository<BusinessInvitation>,
    private readonly businesses: BusinessesService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * - owner (o super_admin) invita con cualquier rol.
   * - admin solo invita staff.
   * Reenviar a un mismo destinatario revoca la invitación pendiente anterior.
   */
  async create(
    actor: BusinessActor,
    businessId: string,
    dto: CreateInvitationDto,
  ): Promise<BusinessInvitation> {
    this.assertCanInvite(actor, dto.role);
    const business = await this.businesses.findByIdOrFail(businessId);
    await this.assertSeatAvailable(business, dto.recipient);

    if (dto.channel === NotificationChannel.Email) {
      const existing = await this.users.findByEmail(dto.recipient);
      if (
        existing &&
        (await this.businesses.findMembership(businessId, existing.id))
      ) {
        throw new ConflictException('Ese usuario ya es miembro del negocio.');
      }
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = Number(this.config.get('INVITATION_TTL_HOURS', '168'));

    const invitation = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        BusinessInvitation,
        {
          businessId,
          recipient: dto.recipient,
          status: InvitationStatus.Pending,
        },
        { status: InvitationStatus.Revoked },
      );
      return manager.save(
        manager.create(BusinessInvitation, {
          businessId,
          channel: dto.channel,
          recipient: dto.recipient,
          role: dto.role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
          invitedById: actor.user.id,
        }),
      );
    });

    const acceptUrl = new URL(
      this.config.getOrThrow<string>('INVITATION_ACCEPT_URL'),
    );
    acceptUrl.searchParams.set('token', token);

    try {
      await this.notifications.send(dto.channel, {
        to: dto.recipient,
        subject: `Invitación a ${business.name}`,
        body:
          `${actor.user.name} te invitó a unirte a "${business.name}" como ${dto.role}.\n` +
          `Acepta la invitación aquí: ${acceptUrl.toString()}`,
      });
    } catch (error) {
      this.logger.error('No se pudo enviar la invitación', error as Error);
      await this.invitations.update(invitation.id, {
        status: InvitationStatus.Revoked,
      });
      throw new ServiceUnavailableException(
        'No se pudo enviar la invitación. Inténtalo de nuevo.',
      );
    }

    // No exponer el hash del token en la respuesta.
    const { tokenHash: _omit, ...rest } = invitation;
    return rest as BusinessInvitation;
  }

  /** Invitaciones pendientes y vigentes del negocio. */
  listPending(businessId: string): Promise<BusinessInvitation[]> {
    return this.invitations.find({
      where: {
        businessId,
        status: InvitationStatus.Pending,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(businessId: string, invitationId: string): Promise<void> {
    const result = await this.invitations.update(
      { id: invitationId, businessId, status: InvitationStatus.Pending },
      { status: InvitationStatus.Revoked },
    );
    if (!result.affected) {
      throw new NotFoundException('Invitación pendiente no encontrada.');
    }
  }

  /**
   * Acepta la invitación con el usuario autenticado. Tener el token prueba
   * que el usuario recibió el mensaje en el email o teléfono invitado.
   */
  accept(user: User, token: string): Promise<BusinessMember> {
    return this.dataSource.transaction(async (manager) => {
      const invitation = await manager.findOne(BusinessInvitation, {
        where: { tokenHash: hashToken(token) },
        lock: { mode: 'pessimistic_write' },
      });

      if (
        !invitation ||
        invitation.status !== InvitationStatus.Pending ||
        invitation.expiresAt.getTime() <= Date.now()
      ) {
        throw new BadRequestException(INVALID_INVITATION);
      }

      const alreadyMember = await manager.existsBy(BusinessMember, {
        businessId: invitation.businessId,
        userId: user.id,
      });
      if (alreadyMember) {
        throw new ConflictException('Ya eres miembro de este negocio.');
      }
      // El plan pudo bajar después de enviar la invitación.
      const business = await manager.findOneByOrFail(Business, {
        id: invitation.businessId,
      });
      const members = await manager.countBy(BusinessMember, {
        businessId: invitation.businessId,
      });
      if (members >= planDefinition(business.plan).maxMembers) {
        throw new BadRequestException(
          'Este negocio alcanzó el límite de personas de su plan.',
        );
      }

      const member = await manager.save(
        manager.create(BusinessMember, {
          businessId: invitation.businessId,
          userId: user.id,
          role: invitation.role,
        }),
      );

      invitation.status = InvitationStatus.Accepted;
      invitation.acceptedById = user.id;
      invitation.acceptedAt = new Date();
      await manager.save(invitation);

      return member;
    });
  }

  /**
   * Las invitaciones pendientes ocupan cupo, para no pasar el límite
   * invitando a muchos a la vez. Reinvitar al mismo destinatario no suma.
   */
  private async assertSeatAvailable(
    business: Business,
    recipient: string,
  ): Promise<void> {
    const [members, pending] = await Promise.all([
      this.dataSource.manager.countBy(BusinessMember, {
        businessId: business.id,
      }),
      this.invitations.countBy({
        businessId: business.id,
        status: InvitationStatus.Pending,
        expiresAt: MoreThan(new Date()),
        recipient: Not(recipient),
      }),
    ]);
    const plan = planDefinition(business.plan);
    if (members + pending >= plan.maxMembers) {
      throw new BadRequestException(
        `Tu plan ${plan.name} permite hasta ${plan.maxMembers} personas. Mejora el plan para invitar a más.`,
      );
    }
  }

  private assertCanInvite(actor: BusinessActor, role: BusinessRole) {
    if (actor.user.platformRole === PlatformRole.SuperAdmin) return;
    const actorRole = actor.membership?.role;
    if (actorRole === BusinessRole.Owner) return;
    if (actorRole === BusinessRole.Admin && role === BusinessRole.Staff) return;
    throw new ForbiddenException('Tu rol no permite invitar con ese rol.');
  }
}
