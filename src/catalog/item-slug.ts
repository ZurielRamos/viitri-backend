/** Largo máximo del slug de un elemento, sin contar el sufijo de repetidos. */
const MAX_BASE = 80;

/**
 * Slug legible a partir del nombre: "Hamburguesa Sencilla" →
 * "hamburguesa-sencilla". Sin tildes ni eñes, para que el enlace se vea igual
 * en cualquier teléfono.
 */
export function slugifyName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE)
    .replace(/-+$/g, '');
  return slug || 'producto';
}

/**
 * El primero libre en la tienda: el slug del nombre y, si ya existe,
 * "-2", "-3"… al final.
 */
export function firstFreeSlug(
  base: string,
  taken: ReadonlySet<string>,
): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
