/** Escapa los comodines de LIKE/ILIKE para buscar texto literal. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
