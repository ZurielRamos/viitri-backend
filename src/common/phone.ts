/** Teléfono en formato internacional E.164, por ejemplo +5491122334455. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export const E164_MESSAGE =
  'El teléfono debe estar en formato E.164, por ejemplo +5491122334455.';

/** Quita espacios, guiones y paréntesis antes de validar. */
export function normalizePhone(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value;
}
