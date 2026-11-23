import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Mutation, TtlStore } from '../../common/ttl-store/ttl-store.js';
import {
  WhatsappDeliveryError,
  type WhatsappAuthTemplateClient,
} from '../../notifications/whatsapp/whatsapp-auth-template.client.js';
import {
  OTP_COOLDOWN_SECONDS,
  OTP_HOURLY_LIMIT,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  OtpService,
} from './otp.service.js';

/** Almacén en memoria con reloj controlable. */
class FakeTtlStore implements TtlStore {
  now = 0;
  readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  private live(key: string) {
    const entry = this.entries.get(key);
    return entry && entry.expiresAt > this.now ? entry : undefined;
  }

  advance(seconds: number) {
    this.now += seconds * 1000;
  }

  set(key: string, value: unknown, ttlSeconds: number) {
    this.entries.set(key, { value, expiresAt: this.now + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  setIfAbsent(key: string, value: unknown, ttlSeconds: number) {
    if (this.live(key)) return Promise.resolve(false);
    return this.set(key, value, ttlSeconds).then(() => true);
  }

  delete(key: string) {
    this.entries.delete(key);
    return Promise.resolve();
  }

  mutate<T, R>(key: string, fn: (current: T | null) => Mutation<T, R>) {
    const entry = this.live(key);
    const { value, result } = fn((entry?.value as T | undefined) ?? null);
    if (entry && value !== undefined) {
      if (value === null) this.entries.delete(key);
      else entry.value = value;
    }
    return Promise.resolve(result);
  }
}

const TARGET = { purpose: 'auth', scope: 'platform', phone: '3001234567' };
const CODE_KEY = 'otp:auth:platform:573001234567';
const COOLDOWN_KEY = 'otp:cooldown:auth:platform:573001234567';

describe('OtpService', () => {
  let store: FakeTtlStore;
  let sendAuthCode: Mock<WhatsappAuthTemplateClient['sendAuthCode']>;
  let service: OtpService;
  let nodeEnv: string;

  const build = (
    whatsapp: Pick<WhatsappAuthTemplateClient, 'sendAuthCode'> | null,
  ) =>
    new OtpService(
      store,
      whatsapp as WhatsappAuthTemplateClient | null,
      { get: () => nodeEnv } as unknown as ConfigService,
    );

  /** El código que se envió por WhatsApp. */
  const sentCode = () => sendAuthCode.mock.calls.at(-1)![1] as string;

  beforeEach(() => {
    store = new FakeTtlStore();
    sendAuthCode = vi
      .fn<WhatsappAuthTemplateClient['sendAuthCode']>()
      .mockResolvedValue(undefined);
    nodeEnv = 'test';
    service = build({ sendAuthCode });
  });

  describe('send', () => {
    it('genera un código de 4 dígitos y lo envía al número normalizado', async () => {
      await service.send(TARGET);

      expect(sendAuthCode).toHaveBeenCalledWith(
        '573001234567',
        expect.stringMatching(/^\d{4}$/),
      );
      expect(Number(sentCode())).toBeGreaterThanOrEqual(1000);
    });

    it('guarda el código y el cooldown con su TTL', async () => {
      await service.send(TARGET, { extra: true });

      expect(store.entries.get(CODE_KEY)).toMatchObject({
        value: { code: sentCode(), attempts: 0, payload: { extra: true } },
        expiresAt: OTP_TTL_SECONDS * 1000,
      });
      expect(store.entries.get(COOLDOWN_KEY)?.expiresAt).toBe(
        OTP_COOLDOWN_SECONDS * 1000,
      );
    });

    it('rechaza un reenvío durante el cooldown y lo permite después', async () => {
      await service.send(TARGET);

      await expect(service.send(TARGET)).rejects.toThrow(
        'Espera unos segundos antes de solicitar otro código.',
      );
      expect(sendAuthCode).toHaveBeenCalledTimes(1);

      store.advance(OTP_COOLDOWN_SECONDS + 1);
      await expect(service.send(TARGET)).resolves.toBeUndefined();
      expect(sendAuthCode).toHaveBeenCalledTimes(2);
    });

    it('un nuevo envío reemplaza al código anterior', async () => {
      await service.send(TARGET);
      const first = sentCode();
      store.advance(OTP_COOLDOWN_SECONDS + 1);
      await service.send(TARGET);
      const second = sentCode();

      if (first !== second) {
        expect((await service.verify(TARGET, first)).status).toBe('mismatch');
      }
      expect((await service.verify(TARGET, second)).status).toBe('ok');
    });

    it('responde 400 y libera el cooldown si el envío falla', async () => {
      sendAuthCode.mockRejectedValueOnce(
        new WhatsappDeliveryError('boom', 500, 'detalle interno'),
      );

      const error = await service.send(TARGET).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'No se pudo enviar el código por WhatsApp. Verifica el número e intenta de nuevo.',
      );
      // El código y el cooldown se borran; el envío fallido sí cuenta para el tope por hora.
      expect(store.entries.has(CODE_KEY)).toBe(false);
      expect(store.entries.has(COOLDOWN_KEY)).toBe(false);
      await expect(service.send(TARGET)).resolves.toBeUndefined();
    });

    it('limita los envíos por número cada hora', async () => {
      for (let i = 0; i < OTP_HOURLY_LIMIT; i++) {
        await service.send(TARGET);
        store.advance(OTP_COOLDOWN_SECONDS + 1);
      }

      await expect(service.send(TARGET)).rejects.toMatchObject({ status: 429 });
      expect(sendAuthCode).toHaveBeenCalledTimes(OTP_HOURLY_LIMIT);

      // Otro número no se ve afectado.
      await expect(
        service.send({ ...TARGET, phone: '3009999999' }),
      ).resolves.toBeUndefined();

      store.advance(60 * 60);
      await expect(service.send(TARGET)).resolves.toBeUndefined();
    });

    it('sin credenciales y fuera de producción, no falla y guarda el código', async () => {
      service = build(null);

      await expect(service.send(TARGET)).resolves.toBeUndefined();
      expect(store.entries.has(CODE_KEY)).toBe(true);
    });

    it('sin credenciales en producción, falla', async () => {
      nodeEnv = 'production';
      service = build(null);

      await expect(service.send(TARGET)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // El código y el cooldown se borran; el envío fallido sí cuenta para el tope por hora.
      expect(store.entries.has(CODE_KEY)).toBe(false);
      expect(store.entries.has(COOLDOWN_KEY)).toBe(false);
    });
  });

  describe('verify', () => {
    it('devuelve not_found si no hay código', async () => {
      expect(await service.verify(TARGET, '123456')).toEqual({
        status: 'not_found',
      });
    });

    it('acepta el código correcto, con el payload, y lo consume', async () => {
      await service.send(TARGET, { hello: 'world' });
      const code = sentCode();

      expect(await service.verify(TARGET, code)).toEqual({
        status: 'ok',
        payload: { hello: 'world' },
      });
      expect(await service.verify(TARGET, code)).toEqual({
        status: 'not_found',
      });
    });

    it('acepta el número en cualquier formato equivalente', async () => {
      await service.send(TARGET);

      const result = await service.verify(
        { ...TARGET, phone: '+57 300 123 4567' },
        sentCode(),
      );
      expect(result.status).toBe('ok');
    });

    it('devuelve mismatch, cuenta el intento y conserva el TTL', async () => {
      await service.send(TARGET);
      store.advance(100);
      const wrong = sentCode() === '1111' ? '2222' : '1111';

      expect(await service.verify(TARGET, wrong)).toEqual({
        status: 'mismatch',
      });

      expect(store.entries.get(CODE_KEY)).toMatchObject({
        value: { attempts: 1 },
        expiresAt: OTP_TTL_SECONDS * 1000,
      });
    });

    it('bloquea y borra el código tras agotar los intentos, aunque acierte', async () => {
      await service.send(TARGET);
      const code = sentCode();
      const wrong = code === '1111' ? '2222' : '1111';

      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        expect((await service.verify(TARGET, wrong)).status).toBe('mismatch');
      }

      expect(await service.verify(TARGET, code)).toEqual({
        status: 'too_many_attempts',
      });
      expect(await service.verify(TARGET, code)).toEqual({
        status: 'not_found',
      });
    });

    it('el código expira a los 5 minutos', async () => {
      await service.send(TARGET);
      const code = sentCode();

      store.advance(OTP_TTL_SECONDS + 1);

      expect(await service.verify(TARGET, code)).toEqual({
        status: 'not_found',
      });
    });

    it('no acepta un código de otro propósito, ámbito o número', async () => {
      await service.send(TARGET);
      const code = sentCode();

      for (const other of [
        { ...TARGET, purpose: 'otro' },
        { ...TARGET, scope: 'otro' },
        { ...TARGET, phone: '3009999999' },
      ]) {
        expect(await service.verify(other, code)).toEqual({
          status: 'not_found',
        });
      }
    });

    it('rechaza códigos de otra longitud sin lanzar', async () => {
      await service.send(TARGET);

      expect((await service.verify(TARGET, '123')).status).toBe('mismatch');
    });
  });
});
