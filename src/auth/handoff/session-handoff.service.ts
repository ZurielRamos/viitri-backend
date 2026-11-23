import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TTL_STORE, type TtlStore } from '../../common/ttl-store/ttl-store.js';
import type { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/users.service.js';
import type { JwtPayload } from '../authenticated-request.js';

/** Segundos que vale un código: solo el tiempo de una redirección. */
export const HANDOFF_TTL_SECONDS = 60;

/**
 * Pasa la sesión del dominio principal a la tienda del negocio, que vive en
 * otro subdominio y no ve su cookie. El dominio principal pide un código de un
 * solo uso y redirige a la tienda con él; la tienda lo canjea por una sesión
 * propia. Se guarda solo el hash del código: quien lea la tabla no puede usarlo.
 */
@Injectable()
export class SessionHandoffService {
  constructor(
    @Inject(TTL_STORE) private readonly store: TtlStore,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async create(user: User): Promise<{ code: string }> {
    const code = randomBytes(32).toString('base64url');
    await this.store.set(key(code), { userId: user.id }, HANDOFF_TTL_SECONDS);
    return { code };
  }

  /** Canjea el código una sola vez, aunque lleguen dos canjes a la vez. */
  async redeem(code: string): Promise<{ accessToken: string }> {
    const entry = await this.store.mutate<{ userId: string }, string | null>(
      key(code),
      (current) => ({ value: null, result: current?.userId ?? null }),
    );
    if (!entry) throw new UnauthorizedException('El enlace ya no es válido.');
    const user = await this.users.findById(entry);
    if (!user) throw new UnauthorizedException('El enlace ya no es válido.');
    const payload: JwtPayload = { sub: user.id, typ: 'user' };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}

function key(code: string): string {
  return `handoff:${createHash('sha256').update(code).digest('hex')}`;
}
