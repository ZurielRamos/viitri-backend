import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { TTL_STORE, type TtlStore } from '../../common/ttl-store/ttl-store.js';
import { AccountMailService } from '../../notifications/mail/account-mail.service.js';
import { PlatformRole } from '../../users/platform-role.enum.js';
import { UsersService } from '../../users/users.service.js';

/** Minutos que vale el enlace. */
export const RESET_TTL_MINUTES = 60;
/** Segundos mínimos entre dos solicitudes de la misma cuenta. */
export const RESET_COOLDOWN_SECONDS = 60;

const INVALID_LINK =
  'El enlace no es válido o ya venció. Pide uno nuevo desde "Olvidé mi contraseña".';

/**
 * Recuperación de contraseña del panel admin. Se guarda solo el hash del
 * token (quien lea la tabla no puede usarlo), vale una vez y solo el último
 * enlace pedido funciona.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(TTL_STORE) private readonly store: TtlStore,
    private readonly users: UsersService,
    private readonly mail: AccountMailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * No revela si el correo existe: siempre termina igual. Solo las cuentas
   * super_admin con contraseña reciben el enlace, porque apunta al panel admin.
   */
  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.email || user.platformRole !== PlatformRole.SuperAdmin) return;

    const allowed = await this.store.setIfAbsent(
      `pwreset-cooldown:${user.id}`,
      true,
      RESET_COOLDOWN_SECONDS,
    );
    if (!allowed) return;

    const token = randomBytes(32).toString('base64url');
    const ttl = RESET_TTL_MINUTES * 60;
    // Invalida el enlace anterior de la misma cuenta.
    const userKey = `pwreset-user:${user.id}`;
    const previous = await this.store.mutate<
      { tokenKey: string },
      string | null
    >(userKey, (current) => ({ result: current?.tokenKey ?? null }));
    if (previous) await this.store.delete(previous);
    const tokenKey = key(token);
    await this.store.set(tokenKey, { userId: user.id }, ttl);
    await this.store.set(userKey, { tokenKey }, ttl);

    const adminUrl = this.config.get<string>(
      'ADMIN_URL',
      'http://localhost:5174',
    );
    const resetUrl = new URL('/reset-password', adminUrl);
    resetUrl.searchParams.set('token', token);
    await this.mail.sendPasswordReset(
      { name: user.name, email: user.email },
      { resetUrl: resetUrl.toString(), expiresInMinutes: RESET_TTL_MINUTES },
    );
  }

  /** Canjea el token una sola vez, aunque lleguen dos a la vez. */
  async reset(token: string, password: string): Promise<void> {
    const userId = await this.store.mutate<{ userId: string }, string | null>(
      key(token),
      (current) => ({ value: null, result: current?.userId ?? null }),
    );
    if (!userId) throw new BadRequestException(INVALID_LINK);
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException(INVALID_LINK);
    await this.users.setPasswordHash(user.id, await argon2.hash(password));
    await this.store.delete(`pwreset-user:${user.id}`);
  }
}

function key(token: string): string {
  return `pwreset:${createHash('sha256').update(token).digest('hex')}`;
}
