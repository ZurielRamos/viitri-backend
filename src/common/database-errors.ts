import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';

/** Indica si el error es una violación de restricción UNIQUE en Postgres. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      PG_UNIQUE_VIOLATION
  );
}
