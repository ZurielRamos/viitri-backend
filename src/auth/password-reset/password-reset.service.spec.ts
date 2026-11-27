import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { Mutation, TtlStore } from '../../common/ttl-store/ttl-store.js';
import { PlatformRole } from '../../users/platform-role.enum.js';
import { PasswordResetService } from './password-reset.service.js';

class MemoryStore implements TtlStore {
  data = new Map<string, unknown>();
  set(key: string, value: unknown) {
    this.data.set(key, value);
    return Promise.resolve();
  }
  setIfAbsent(key: string, value: unknown) {
    if (this.data.has(key)) return Promise.resolve(false);
    this.data.set(key, value);
    return Promise.resolve(true);
  }
  delete(key: string) {
    this.data.delete(key);
    return Promise.resolve();
  }
  mutate<T, R>(key: string, fn: (c: T | null) => Mutation<T, R>) {
    const current = (this.data.get(key) as T | undefined) ?? null;
    const { value, result } = fn(current);
    if (current !== null && value === null) this.data.delete(key);
    else if (current !== null && value !== undefined) this.data.set(key, value);
    return Promise.resolve(result);
  }
}

function setup(role = PlatformRole.SuperAdmin) {
  const user = {
    id: 'u1',
    name: 'Ana',
    email: 'ana@viitri.com',
    platformRole: role,
  };
  const users = {
    findByEmail: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    setPasswordHash: vi.fn().mockResolvedValue(undefined),
  };
  const mail = { sendPasswordReset: vi.fn().mockResolvedValue(undefined) };
  const config = { get: (_: string, d: string) => d };
  const store = new MemoryStore();
  const service = new PasswordResetService(
    store,
    users as never,
    mail as never,
    config as never,
  );
  const tokenSent = () => {
    const url = new URL(mail.sendPasswordReset.mock.calls.at(-1)![1].resetUrl);
    return url.searchParams.get('token')!;
  };
  return { service, users, mail, store, tokenSent };
}

describe('PasswordResetService', () => {
  it('envía el enlace al panel admin', async () => {
    const { service, mail } = setup();
    await service.request('ana@viitri.com');
    const url = new URL(mail.sendPasswordReset.mock.calls[0]![1].resetUrl);
    expect(url.origin + url.pathname).toBe(
      'http://localhost:5174/reset-password',
    );
  });

  it('no envía nada a cuentas que no son super_admin', async () => {
    const { service, mail } = setup(PlatformRole.User);
    await service.request('ana@viitri.com');
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('limita las solicitudes seguidas', async () => {
    const { service, mail } = setup();
    await service.request('ana@viitri.com');
    await service.request('ana@viitri.com');
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('cambia la contraseña y el enlace sirve una sola vez', async () => {
    const { service, users, tokenSent } = setup();
    await service.request('ana@viitri.com');
    const token = tokenSent();
    await service.reset(token, 'nueva-clave-123');
    const hash = users.setPasswordHash.mock.calls[0]![1] as string;
    expect(await argon2.verify(hash, 'nueva-clave-123')).toBe(true);
    await expect(service.reset(token, 'otra-clave-123')).rejects.toThrow();
  });

  it('rechaza un token desconocido', async () => {
    const { service } = setup();
    await expect(
      service.reset('x'.repeat(43), 'nueva-clave-123'),
    ).rejects.toThrow();
  });
});
