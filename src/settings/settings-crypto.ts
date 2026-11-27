import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Cifrado de los valores guardados (AES-256-GCM). Quien lea la tabla
 * `platform_settings` no ve las credenciales sin la clave del servidor.
 * Formato: `v1.<iv>.<tag>.<datos>`, en base64url.
 */
const VERSION = 'v1';

export interface SettingsKeySource {
  SETTINGS_ENCRYPTION_KEY?: string;
  JWT_SECRET?: string;
  NODE_ENV?: string;
}

/**
 * La clave sale de SETTINGS_ENCRYPTION_KEY. En desarrollo, sin ella, se
 * deriva de JWT_SECRET (cambiar JWT_SECRET deja ilegibles los valores).
 */
export function settingsKey(env: SettingsKeySource): Buffer {
  if (env.SETTINGS_ENCRYPTION_KEY) {
    return createHash('sha256').update(env.SETTINGS_ENCRYPTION_KEY).digest();
  }
  if (env.NODE_ENV === 'production' || !env.JWT_SECRET) {
    throw new Error('SETTINGS_ENCRYPTION_KEY es obligatorio.');
  }
  return Buffer.from(
    hkdfSync('sha256', env.JWT_SECRET, 'viitri', 'platform-settings', 32),
  );
}

export function encryptSetting(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) =>
      typeof part === 'string' ? part : part.toString('base64url'),
    )
    .join('.');
}

export function decryptSetting(payload: string, key: Buffer): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error('Formato de valor cifrado desconocido.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
