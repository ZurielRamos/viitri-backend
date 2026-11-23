import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../users/entities/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import type { AccountMailService } from '../notifications/mail/account-mail.service.js';
import { AuthService } from './auth.service.js';
import type { GoogleIdentityVerifier } from './google/google-identity.verifier.js';
import type { OtpService } from './otp/otp.service.js';

describe('AuthService: acceso con teléfono', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const user = { id: 'u1', phone: '573001234567', name: 'Ana' } as User;

  let otp: { send: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
  let users: {
    findByPhone: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    otp = {
      send: vi.fn(),
      verify: vi.fn().mockResolvedValue({ status: 'ok', payload: null }),
    };
    users = { findByPhone: vi.fn(), create: vi.fn().mockResolvedValue(user) };
    service = new AuthService(
      users as unknown as UsersService,
      jwt,
      { sendWelcome: vi.fn() } as unknown as AccountMailService,
      otp as unknown as OtpService,
      {} as GoogleIdentityVerifier,
    );
  });

  it('inicia sesión si el número ya tiene cuenta', async () => {
    users.findByPhone.mockResolvedValue(user);

    const result = await service.verifyOtp({
      phone: '573001234567',
      code: '123456',
    });

    expect(result).toMatchObject({ status: 'authenticated', user });
    const { accessToken } = result as { accessToken: string };
    expect(await jwt.verifyAsync(accessToken)).toMatchObject({
      sub: 'u1',
      typ: 'user',
    });
  });

  it('pide completar el registro si el número es nuevo', async () => {
    users.findByPhone.mockResolvedValue(null);

    const result = await service.verifyOtp({
      phone: '573001234567',
      code: '123456',
    });

    expect(result.status).toBe('registration_required');
    const { registrationToken } = result as { registrationToken: string };
    expect(await jwt.verifyAsync(registrationToken)).toMatchObject({
      typ: 'phone-registration',
      phone: '573001234567',
    });
  });

  it.each([
    ['not_found', 400],
    ['mismatch', 400],
    ['too_many_attempts', 429],
  ])('traduce %s a HTTP %i', async (status, http) => {
    otp.verify.mockResolvedValue({ status });

    await expect(
      service.verifyOtp({ phone: '573001234567', code: '123456' }),
    ).rejects.toMatchObject({ status: http });
    expect(users.findByPhone).not.toHaveBeenCalled();
  });

  it('crea la cuenta sin contraseña con el teléfono verificado', async () => {
    users.findByPhone.mockResolvedValue(null);
    const { registrationToken } = (await service.verifyOtp({
      phone: '573001234567',
      code: '123456',
    })) as { registrationToken: string };

    const result = await service.registerWithPhone({
      registrationToken,
      name: 'Ana',
      email: 'ana@example.com',
      acceptedTerms: true,
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        name: 'Ana',
        passwordHash: null,
        phone: '573001234567',
      }),
    );
    expect(result.user).toBe(user);
  });

  it('rechaza un token de sesión como token de registro', async () => {
    const sessionToken = await jwt.signAsync({ sub: 'u1', typ: 'user' });

    await expect(
      service.registerWithPhone({
        registrationToken: sessionToken,
        name: 'X',
        email: 'x@example.com',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rechaza un token de registro inválido', async () => {
    await expect(
      service.registerWithPhone({
        registrationToken: 'no-es-un-jwt-pero-es-largo-suficiente',
        name: 'X',
        email: 'x@example.com',
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthService: login por email', () => {
  it('no deja entrar con contraseña a una cuenta creada por WhatsApp', async () => {
    const users = {
      findByEmailWithPassword: vi
        .fn()
        .mockResolvedValue({ id: 'u1', passwordHash: null }),
      findByIdOrFail: vi.fn(),
    };
    const service = new AuthService(
      users as unknown as UsersService,
      new JwtService({ secret: 'x'.repeat(32) }),
      { sendWelcome: vi.fn() } as unknown as AccountMailService,
      {} as OtpService,
      {} as GoogleIdentityVerifier,
    );

    await expect(
      service.login({ email: 'ana@example.com', password: 'timing-equalizer' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(users.findByIdOrFail).not.toHaveBeenCalled();
  });
});
