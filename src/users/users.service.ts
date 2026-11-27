import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { User } from './entities/user.entity.js';
import { PlatformRole } from './platform-role.enum.js';
import type { Acquisition, ReferralSource } from './referral-source.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const CONFLICT_MESSAGES: Record<string, string> = {
  uq_users_phone: 'Este número ya tiene una cuenta. Inicia sesión.',
  uq_users_google_sub:
    'Esta cuenta de Google ya está vinculada a otro usuario.',
};

/** Traduce una violación de UNIQUE a un 409 con un mensaje claro. */
function toConflict(error: unknown): unknown {
  if (!isUniqueViolation(error)) return error;
  const constraint = (error as { driverError?: { constraint?: string } })
    .driverError?.constraint;
  return new ConflictException(
    (constraint && CONFLICT_MESSAGES[constraint]) ??
      'El email ya está registrado.',
  );
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(data: {
    /** Nulo: cuenta por WhatsApp sin correo (se pide al pagar). */
    email: string | null;
    name: string;
    passwordHash: string | null;
    phone?: string;
    googleSub?: string;
    termsAcceptedAt?: Date | null;
    marketingOptInAt?: Date | null;
    acquisition?: Acquisition | null;
  }): Promise<User> {
    const user = this.users.create({
      email: data.email ? normalizeEmail(data.email) : null,
      name: data.name.trim(),
      passwordHash: data.passwordHash,
      phone: data.phone ?? null,
      googleSub: data.googleSub ?? null,
      termsAcceptedAt: data.termsAcceptedAt ?? null,
      marketingOptInAt: data.marketingOptInAt ?? null,
      acquisition: data.acquisition ?? null,
    });
    try {
      const saved = await this.users.save(user);
      return this.findByIdOrFail(saved.id);
    } catch (error) {
      throw toConflict(error);
    }
  }

  /** Vincula el teléfono o la cuenta de Google de un usuario existente. */
  async linkIdentity(
    id: string,
    data: { phone?: string; googleSub?: string },
  ): Promise<User> {
    try {
      await this.users.update(id, data);
    } catch (error) {
      throw toConflict(error);
    }
    return this.findByIdOrFail(id);
  }

  /** Marca la bienvenida como vista y guarda la respuesta, si la hubo. */
  async completeOnboarding(
    id: string,
    referralSource: ReferralSource | null,
  ): Promise<User> {
    await this.users.update(id, {
      onboardedAt: new Date(),
      ...(referralSource && { referralSource }),
    });
    return this.findByIdOrFail(id);
  }

  findByProviderSub(provider: 'google', sub: string): Promise<User | null> {
    return this.users.findOneBy({ googleSub: sub });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.users.findOneBy({ phone });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: normalizeEmail(email) });
  }

  /** Incluye el hash de la contraseña; usar solo para autenticar. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findAll(options: { skip: number; take: number }): Promise<[User[], number]> {
    return this.users.findAndCount({
      order: { createdAt: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update(id, { passwordHash });
  }

  /** Nuevo WhatsApp de la cuenta; cierra sus sesiones abiertas. 409 si otro lo usa. */
  async setPhone(id: string, phone: string): Promise<User> {
    await this.findByIdOrFail(id);
    try {
      await this.users.update(id, { phone });
    } catch (error) {
      throw toConflict(error);
    }
    await this.users.increment({ id }, 'sessionVersion', 1);
    return this.findByIdOrFail(id);
  }

  async setPlatformRole(id: string, role: PlatformRole): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.platformRole = role;
    return this.users.save(user);
  }
}
