import { Logger } from '@nestjs/common';
import pg from 'pg';
import { databaseOptions } from '../database/database.options.js';
import { decryptSetting, settingsKey } from './settings-crypto.js';
import { SETTING_KEYS } from './settings.registry.js';

/** Valores del `.env` antes de aplicar los del panel: a ellos se vuelve al borrar uno. */
export const ENV_DEFAULTS = new Map<string, string | undefined>();

/**
 * Antes de crear la app, copia a `process.env` las credenciales guardadas
 * desde el panel. Así cada módulo las lee al arrancar como si vinieran del
 * `.env`. Si la tabla no existe todavía o la base no responde, arranca solo
 * con el `.env`.
 */
export async function applyStoredSettings(): Promise<void> {
  const logger = new Logger('Settings');
  for (const key of SETTING_KEYS) ENV_DEFAULTS.set(key, process.env[key]);

  const options = databaseOptions((k) => process.env[k]);
  const client = new pg.Client({
    host: options.host,
    port: options.port,
    user: options.username,
    password: options.password as string,
    database: options.database as string,
    connectionTimeoutMillis: 10_000,
  });
  let rows: { key: string; value: string }[];
  try {
    await client.connect();
    const result = await client.query<{ key: string; value: string }>(
      `SELECT key, value FROM platform_settings`,
    );
    rows = result.rows;
  } catch (error) {
    // 42P01: la tabla aún no existe (primer arranque).
    if ((error as { code?: string }).code !== '42P01') {
      logger.warn(
        `No se pudieron leer las credenciales del panel: ${(error as Error).message}`,
      );
    }
    return;
  } finally {
    await client.end().catch(() => undefined);
  }
  if (!rows.length) return;

  const key = settingsKey(process.env);
  const applied: string[] = [];
  for (const row of rows) {
    if (!SETTING_KEYS.has(row.key)) continue;
    try {
      process.env[row.key] = decryptSetting(row.value, key);
      applied.push(row.key);
    } catch {
      logger.error(
        `No se pudo descifrar ${row.key}: ¿cambió SETTINGS_ENCRYPTION_KEY? Se usa el valor del .env.`,
      );
    }
  }
  if (applied.length) {
    logger.log(`Credenciales del panel aplicadas: ${applied.join(', ')}`);
  }
}
