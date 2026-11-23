import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Mutation, TtlStore } from './ttl-store.js';

/** Implementación sobre la tabla `ttl_entries` de Postgres. */
@Injectable()
export class TypeOrmTtlStore implements TtlStore {
  constructor(private readonly dataSource: DataSource) {}

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    // Limpieza oportunista: el índice por expires_at la mantiene barata.
    await this.dataSource.query(
      `DELETE FROM "ttl_entries" WHERE "expires_at" < now()`,
    );
    await this.dataSource.query(
      `INSERT INTO "ttl_entries" ("key", "value", "expires_at")
       VALUES ($1, $2::jsonb, now() + make_interval(secs => $3))
       ON CONFLICT ("key") DO UPDATE
         SET "value" = EXCLUDED."value", "expires_at" = EXCLUDED."expires_at"`,
      [key, JSON.stringify(value), ttlSeconds],
    );
  }

  async setIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    // El UPDATE solo aplica si la fila existente ya venció, así que la
    // adquisición es atómica aunque lleguen dos peticiones a la vez.
    const rows: unknown[] = await this.dataSource.query(
      `INSERT INTO "ttl_entries" ("key", "value", "expires_at")
       VALUES ($1, $2::jsonb, now() + make_interval(secs => $3))
       ON CONFLICT ("key") DO UPDATE
         SET "value" = EXCLUDED."value", "expires_at" = EXCLUDED."expires_at"
         WHERE "ttl_entries"."expires_at" <= now()
       RETURNING "key"`,
      [key, JSON.stringify(value), ttlSeconds],
    );
    return rows.length > 0;
  }

  async delete(key: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM "ttl_entries" WHERE "key" = $1`, [
      key,
    ]);
  }

  mutate<T, R>(
    key: string,
    fn: (current: T | null) => Mutation<T, R>,
  ): Promise<R> {
    return this.dataSource.transaction(async (manager) => {
      const rows: Array<{ value: T }> = await manager.query(
        `SELECT "value" FROM "ttl_entries"
         WHERE "key" = $1 AND "expires_at" > now()
         FOR UPDATE`,
        [key],
      );
      const current = rows[0]?.value ?? null;
      const { value, result } = fn(current);

      if (current !== null && value !== undefined) {
        if (value === null) {
          await manager.query(`DELETE FROM "ttl_entries" WHERE "key" = $1`, [
            key,
          ]);
        } else {
          await manager.query(
            `UPDATE "ttl_entries" SET "value" = $2::jsonb WHERE "key" = $1`,
            [key, JSON.stringify(value)],
          );
        }
      }
      return result;
    });
  }
}
