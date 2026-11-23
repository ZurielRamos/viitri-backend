import type { DataSourceOptions } from 'typeorm';

type PostgresConnectionOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
>;
type EnvGetter = (key: string) => string | undefined;

/**
 * Opciones de conexión compartidas por la app (Nest) y por el CLI de TypeORM,
 * para que ambos apunten siempre a la misma base y a las mismas migraciones.
 */
export function databaseOptions(env: EnvGetter): PostgresConnectionOptions {
  return {
    type: 'postgres',
    host: env('DB_HOST') ?? 'localhost',
    port: Number(env('DB_PORT') ?? 5432),
    username: env('DB_USERNAME') ?? 'postgres',
    password: env('DB_PASSWORD') ?? 'postgres',
    database: env('DB_NAME') ?? 'menu',
    // DB_SYNCHRONIZE=true crea y ajusta las tablas desde las entidades al
    // arrancar. Solo para desarrollo: puede borrar columnas y datos. En
    // producción el esquema se gestiona con migraciones.
    synchronize: env('DB_SYNCHRONIZE') === 'true',
    // gen_random_uuid() viene incluido en Postgres 13+, sin extensiones.
    uuidExtension: 'pgcrypto',
    migrations: [`${import.meta.dirname}/migrations/*.js`],
    migrationsTableName: 'migrations',
  };
}
