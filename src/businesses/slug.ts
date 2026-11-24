/**
 * Reglas del slug. Son compatibles con etiquetas DNS (3 a 63 caracteres,
 * minúsculas, dígitos y guiones), para poder usarlo después como subdominio.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 63;

/** Slugs reservados para rutas o subdominios de la plataforma. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'dashboard',
  // dev.viitri.com: la API de desarrollo por el túnel de Cloudflare.
  'dev',
  'help',
  'mail',
  'public',
  'static',
  'status',
  'support',
  'www',
]);

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}
