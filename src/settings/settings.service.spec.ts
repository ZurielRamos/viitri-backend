import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptSetting,
  encryptSetting,
  settingsKey,
} from './settings-crypto.js';
import { SettingsService } from './settings.service.js';
import type { PlatformSetting } from './platform-setting.entity.js';

const key = settingsKey({ SETTINGS_ENCRYPTION_KEY: 'x'.repeat(40) });

describe('settings-crypto', () => {
  it('cifra y descifra; el texto guardado no contiene el valor', () => {
    const payload = encryptSetting('super-secreto', key);
    expect(payload).not.toContain('super-secreto');
    expect(decryptSetting(payload, key)).toBe('super-secreto');
  });

  it('con otra clave no descifra', () => {
    const payload = encryptSetting('valor', key);
    const other = settingsKey({ SETTINGS_ENCRYPTION_KEY: 'y'.repeat(40) });
    expect(() => decryptSetting(payload, other)).toThrow();
  });

  it('en producción exige SETTINGS_ENCRYPTION_KEY', () => {
    expect(() =>
      settingsKey({ JWT_SECRET: 'j'.repeat(40), NODE_ENV: 'production' }),
    ).toThrow();
    expect(settingsKey({ JWT_SECRET: 'j'.repeat(40) })).toHaveLength(32);
  });
});

function setup(env: Record<string, string> = {}) {
  const values = new Map(
    Object.entries({ SETTINGS_ENCRYPTION_KEY: 'x'.repeat(40), ...env }),
  );
  const config = {
    get: (k: string) => values.get(k),
    set: (k: string, v: string) => values.set(k, v),
  } as unknown as ConfigService;
  const rows = new Map<string, PlatformSetting>();
  const repo = {
    find: async () => [...rows.values()],
    findBy: async () => [],
    create: (r: PlatformSetting) => r,
    save: async (list: PlatformSetting[]) =>
      list.forEach((r) => rows.set(r.key, r)),
    delete: async ({ key: { _value } }: { key: { _value: string[] } }) =>
      _value.forEach((k) => rows.delete(k)),
  };
  const dataSource = {
    transaction: async (fn: (m: unknown) => unknown) =>
      fn({ getRepository: () => repo }),
  };
  const service = new SettingsService(
    config,
    dataSource as never,
    repo as never,
    repo as never,
  );
  return { service, values, rows };
}

describe('SettingsService', () => {
  // validateEnv revisa el entorno completo, como al arrancar.
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'j'.repeat(40));
    vi.stubEnv('INVITATION_ACCEPT_URL', 'http://localhost/invitaciones');
  });

  it('guarda cifrado, aplica el valor y no devuelve los secretos', async () => {
    const { service, values, rows } = setup({
      JWT_SECRET: 'j'.repeat(40),
      INVITATION_ACCEPT_URL: 'http://x/y',
    });
    const result = await service.update(
      'ai',
      { OPENROUTER_API_KEY: 'sk-or-1234567890abcd' },
      'u1',
    );
    expect(values.get('OPENROUTER_API_KEY')).toBe('sk-or-1234567890abcd');
    expect(rows.get('OPENROUTER_API_KEY')!.value).not.toContain('sk-or');
    const field = result.groups
      .find((g) => g.id === 'ai')!
      .fields.find((f) => f.key === 'OPENROUTER_API_KEY')!;
    expect(field.value).toBeNull();
    expect(field.preview).toBe('••••abcd');
    expect(field.source).toBe('panel');
  });

  it('marca para reiniciar lo que se lee al arrancar', async () => {
    const { service } = setup({
      JWT_SECRET: 'j'.repeat(40),
      INVITATION_ACCEPT_URL: 'http://x/y',
    });
    const result = await service.update(
      'ai',
      { OPENROUTER_MODEL: 'openai/gpt-4o-mini' },
      'u1',
    );
    expect(result.restartPending).toEqual(['OPENROUTER_MODEL']);
  });

  it('rechaza claves de otro servicio, puertos y URLs inválidos', async () => {
    const { service } = setup();
    await expect(
      service.update('mail', { OPENROUTER_API_KEY: 'x' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update('mail', { SMTP_PORT: '99999' }, 'u1'),
    ).rejects.toThrow();
    await expect(
      service.update('whatsapp', { WHATSAPP_API_URL: 'ftp://x' }, 'u1'),
    ).rejects.toThrow();
  });

  it('no deja guardar una configuración con la que la API no arrancaría', async () => {
    const { service } = setup({
      JWT_SECRET: 'j'.repeat(40),
      INVITATION_ACCEPT_URL: 'http://x/y',
    });
    // Bucket sin claves HMAC: el arranque fallaría.
    await expect(
      service.update('storage', { STORAGE_BUCKET: 'b' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('no mezcla llaves de Sandbox y producción en Wompi', async () => {
    const { service } = setup({
      JWT_SECRET: 'j'.repeat(40),
      INVITATION_ACCEPT_URL: 'http://x/y',
    });
    await expect(
      service.update(
        'payments',
        {
          WOMPI_PUBLIC_KEY: 'pub_test_a',
          WOMPI_INTEGRITY_SECRET: 'prod_integrity_b',
          WOMPI_EVENTS_SECRET: 'test_events_c',
        },
        'u1',
      ),
    ).rejects.toThrow(/Sandbox/);
  });
});
