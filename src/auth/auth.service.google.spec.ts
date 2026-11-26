import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountMailService } from '../notifications/mail/account-mail.service.js';
import type { User } from '../users/entities/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { GoogleIdentityVerifier } from './google/google-identity.verifier.js';
import type { OtpService } from './otp/otp.service.js';

const IDENTITY = { sub: 'g-1', email: 'ana@gmail.com', name: 'Ana' };
const LOGIN = {
  idToken: 'id-token-de-prueba-largo',
  nonce: 'nonce-de-prueba-123',
};
const PHONE = { phone: '+573001234567', code: '123456' };

const user = (patch: Partial<User>) =>
  ({
    id: 'u1',
    email: 'ana@gmail.com',
    phone: null,
    googleSub: null,
    ...patch,
  }) as User;

describe('AuthService: Google', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  let users: Record<
    | 'findByProviderSub'
    | 'findByEmail'
    | 'findByPhone'
    | 'linkIdentity'
    | 'create',
    ReturnType<typeof vi.fn>
  >;
  let otp: { verify: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findByProviderSub: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
      findByPhone: vi.fn().mockResolvedValue(null),
      linkIdentity: vi.fn(async (id: string, data: Partial<User>) =>
        user({ id, ...data }),
      ),
      create: vi.fn(async (data: Partial<User>) =>
        user({ id: 'nuevo', ...data }),
      ),
    };
    otp = {
      verify: vi.fn().mockResolvedValue({ status: 'ok', payload: null }),
    };
    service = new AuthService(
      users as unknown as UsersService,
      jwt,
      { sendWelcome: vi.fn() } as unknown as AccountMailService,
      otp as unknown as OtpService,
      {
        verify: vi.fn().mockResolvedValue(IDENTITY),
      } as unknown as GoogleIdentityVerifier,
    );
  });

  async function pendingToken() {
    const result = await service.loginWithGoogle(LOGIN);
    expect(result.status).toBe('phone_required');
    return (result as { pendingToken: string }).pendingToken;
  }

  it('entra directo si la cuenta de Google ya tiene WhatsApp', async () => {
    users.findByProviderSub.mockResolvedValue(
      user({ googleSub: 'g-1', phone: '573001234567' }),
    );

    expect(await service.loginWithGoogle(LOGIN)).toMatchObject({
      status: 'authenticated',
    });
  });

  it('pide WhatsApp a una cuenta nueva y la crea al verificarlo', async () => {
    const token = await pendingToken();

    await service.verifySocialPhone({
      ...PHONE,
      pendingToken: token,
      signup: { acceptedTerms: true },
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@gmail.com',
        name: 'Ana',
        passwordHash: null,
        phone: '573001234567',
        googleSub: 'g-1',
      }),
    );
  });

  it('vincula Google a la cuenta con el mismo correo', async () => {
    users.findByEmail.mockResolvedValue(user({ id: 'existente' }));

    const token = await pendingToken();
    await service.verifySocialPhone({ ...PHONE, pendingToken: token });

    expect(users.linkIdentity).toHaveBeenLastCalledWith('existente', {
      phone: '573001234567',
      googleSub: 'g-1',
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rechaza un número que es de otra cuenta', async () => {
    users.findByEmail.mockResolvedValue(user({ id: 'existente' }));
    const token = await pendingToken();
    users.findByPhone.mockResolvedValue(
      user({ id: 'otra', phone: '573001234567' }),
    );

    await expect(
      service.verifySocialPhone({ ...PHONE, pendingToken: token }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('une la cuenta de Google con la dueña del número', async () => {
    const token = await pendingToken();
    users.findByPhone.mockResolvedValue(
      user({ id: 'por-numero', email: 'otro@x.com', phone: '573001234567' }),
    );

    await service.verifySocialPhone({ ...PHONE, pendingToken: token });

    expect(users.linkIdentity).toHaveBeenCalledWith('por-numero', {
      googleSub: 'g-1',
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('no consume el código si el token pendiente no es válido', async () => {
    const sessionToken = await jwt.signAsync({ sub: 'u1', typ: 'user' });

    await expect(
      service.verifySocialPhone({ ...PHONE, pendingToken: sessionToken }),
    ).rejects.toMatchObject({ status: 401 });
    expect(otp.verify).not.toHaveBeenCalled();
  });

  it('el token pendiente no sirve como sesión', async () => {
    const payload = await jwt.verifyAsync<{ typ: string }>(
      await pendingToken(),
    );
    expect(payload.typ).not.toBe('user');
  });
});
