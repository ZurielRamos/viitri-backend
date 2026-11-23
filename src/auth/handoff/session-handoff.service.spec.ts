import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { Mutation, TtlStore } from '../../common/ttl-store/ttl-store.js';
import type { User } from '../../users/entities/user.entity.js';
import type { UsersService } from '../../users/users.service.js';
import {
  HANDOFF_TTL_SECONDS,
  SessionHandoffService,
} from './session-handoff.service.js';

/** Almacén en memoria con reloj controlable. */
class FakeTtlStore implements TtlStore {
  now = 0;
  readonly entries = new Map<string, { value: unknown; expiresAt: number }>();
  private live(key: string) {
    const entry = this.entries.get(key);
    return entry && entry.expiresAt > this.now ? entry : undefined;
  }
  set(key: string, value: unknown, ttlSeconds: number) {
    this.entries.set(key, { value, expiresAt: this.now + ttlSeconds * 1000 });
    return Promise.resolve();
  }
  setIfAbsent() {
    return Promise.resolve(false);
  }
  delete(key: string) {
    this.entries.delete(key);
    return Promise.resolve();
  }
  mutate<T, R>(key: string, fn: (current: T | null) => Mutation<T, R>) {
    const entry = this.live(key);
    const { value, result } = fn((entry?.value as T | undefined) ?? null);
    if (entry && value === null) this.entries.delete(key);
    return Promise.resolve(result);
  }
}

const USER = { id: 'u1' } as User;

function setup(found: User | null = USER) {
  const store = new FakeTtlStore();
  const users = { findById: vi.fn().mockResolvedValue(found) };
  const jwt = { signAsync: vi.fn().mockResolvedValue('jwt') };
  const service = new SessionHandoffService(
    store,
    users as unknown as UsersService,
    jwt as unknown as JwtService,
  );
  return { store, users, jwt, service };
}

describe('SessionHandoffService', () => {
  it('canjea el código por una sesión del mismo usuario', async () => {
    const { service, jwt } = setup();
    const { code } = await service.create(USER);
    await expect(service.redeem(code)).resolves.toEqual({
      accessToken: 'jwt',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', typ: 'user' });
  });

  it('guarda solo el hash del código', async () => {
    const { service, store } = setup();
    const { code } = await service.create(USER);
    const [key] = [...store.entries.keys()];
    expect(key).toMatch(/^handoff:[0-9a-f]{64}$/);
    expect(key).not.toContain(code);
  });

  it('sirve una sola vez', async () => {
    const { service } = setup();
    const { code } = await service.create(USER);
    await service.redeem(code);
    await expect(service.redeem(code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('vence al minuto', async () => {
    const { service, store } = setup();
    const { code } = await service.create(USER);
    store.now += HANDOFF_TTL_SECONDS * 1000;
    await expect(service.redeem(code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza si el usuario ya no existe', async () => {
    const { service } = setup(null);
    const { code } = await service.create(USER);
    await expect(service.redeem(code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
