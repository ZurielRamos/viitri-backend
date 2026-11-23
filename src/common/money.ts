import type { ValueTransformer } from 'typeorm';

/**
 * Montos en columnas `numeric(12,2)`. Postgres los entrega como texto para
 * no perder precisión; aquí se convierten a número, que es exacto para
 * montos de hasta 2 decimales en este rango.
 */
export const moneyTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** Máximo que cabe en numeric(12,2). */
export const MAX_MONEY = 9_999_999_999.99;

/** Los cálculos se hacen en centavos enteros para evitar errores de redondeo. */
export const toCents = (amount: number): number => Math.round(amount * 100);
export const fromCents = (cents: number): number => cents / 100;
