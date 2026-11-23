/** Tipo de negocio. Sirve para sugerir funcionalidades y para segmentar. */
export const BUSINESS_TYPES = [
  'restaurant',
  'fast_food',
  'bar',
  'cafe',
  'bakery',
  'ice_cream',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
