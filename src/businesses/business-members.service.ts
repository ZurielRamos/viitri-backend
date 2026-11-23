import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { BusinessMember } from './entities/business-member.entity.js';
import { Business } from './entities/business.entity.js';
import { BusinessRole } from './business-role.enum.js';

/** Quién ejecuta la acción dentro del negocio. */
export interface BusinessActor {
  user: User;
  /** `null` si es un super_admin que no es miembro del negocio. */
  membership: BusinessMember | null;
}

const MEMBER_NOT_FOUND = 'El usuario no es miembro de este negocio.';

@Injectable()
export class BusinessMembersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {}

  list(businessId: string): Promise<BusinessMember[]> {
    return this.members.find({
      where: { businessId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  /** Solo owner (o super_admin) cambia roles. */
  async changeRole(
    actor: BusinessActor,
    businessId: string,
    targetUserId: string,
    role: BusinessRole,
  ): Promise<BusinessMember> {
    if (
      !this.isSuperAdmin(actor) &&
      actor.membership?.role !== BusinessRole.Owner
    ) {
      throw new ForbiddenException('Solo un owner puede cambiar roles.');
    }

    return this.dataSource.transaction(async (manager) => {
      await this.lockBusiness(manager, businessId);
      const target = await this.findMemberOrFail(
        manager,
        businessId,
        targetUserId,
      );
      if (target.role === role) return target;
      if (
        role === BusinessRole.Owner &&
        (await this.isTeamProfile(manager, targetUserId))
      ) {
        throw new BadRequestException(
          'Una persona que entra con PIN no puede ser dueña del negocio.',
        );
      }

      if (target.role === BusinessRole.Owner) {
        await this.assertNotLastOwner(manager, businessId);
      }
      target.role = role;
      return manager.save(target);
    });
  }

  /**
   * - Cualquier miembro puede salir del negocio.
   * - owner puede quitar a cualquiera; admin solo a staff.
   * - Nunca se puede dejar el negocio sin owner.
   */
  async remove(
    actor: BusinessActor,
    businessId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockBusiness(manager, businessId);
      const target = await this.findMemberOrFail(
        manager,
        businessId,
        targetUserId,
      );

      const isSelf = actor.user.id === targetUserId;
      if (!isSelf && !this.isSuperAdmin(actor)) {
        const actorRole = actor.membership?.role;
        const allowed =
          actorRole === BusinessRole.Owner ||
          (actorRole === BusinessRole.Admin &&
            target.role === BusinessRole.Staff);
        if (!allowed) {
          throw new ForbiddenException(
            'Tu rol no permite quitar a este miembro.',
          );
        }
      }

      if (target.role === BusinessRole.Owner) {
        await this.assertNotLastOwner(manager, businessId);
      }
      // Un perfil del equipo solo existe para este negocio: se borra entero.
      if (await this.isTeamProfile(manager, targetUserId)) {
        await manager.delete(User, { id: targetUserId });
      } else {
        await manager.remove(target);
      }
    });
  }

  /**
   * Bloquea la fila del negocio para serializar los cambios de membresía
   * y evitar que dos peticiones concurrentes dejen el negocio sin owner.
   */
  private async lockBusiness(manager: EntityManager, businessId: string) {
    const business = await manager.findOne(Business, {
      where: { id: businessId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado.');
  }

  private async findMemberOrFail(
    manager: EntityManager,
    businessId: string,
    userId: string,
  ) {
    const member = await manager.findOneBy(BusinessMember, {
      businessId,
      userId,
    });
    if (!member) throw new NotFoundException(MEMBER_NOT_FOUND);
    return member;
  }

  private async assertNotLastOwner(manager: EntityManager, businessId: string) {
    const owners = await manager.countBy(BusinessMember, {
      businessId,
      role: BusinessRole.Owner,
    });
    if (owners <= 1) {
      throw new BadRequestException('El negocio debe tener al menos un owner.');
    }
  }

  private async isTeamProfile(manager: EntityManager, userId: string) {
    const user = await manager.findOneBy(User, { id: userId });
    return Boolean(user?.teamBusinessId);
  }

  private isSuperAdmin(actor: BusinessActor) {
    return actor.user.platformRole === PlatformRole.SuperAdmin;
  }
}
