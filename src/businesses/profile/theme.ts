/**
 * Diseño de la tienda. Pocas opciones, cada una con un efecto visible: el
 * color principal, fondo claro u oscuro, el estilo de letra y las esquinas.
 */
export const THEME_MODES = ['light', 'dark'] as const;
export const THEME_FONTS = [
  'modern',
  'classic',
  'friendly',
  'elegant',
  'street',
] as const;
export const THEME_CORNERS = ['round', 'soft', 'square'] as const;
/** Fondos de la lista del editor (web/src/lib/theme.ts). `plain`: liso, claro u oscuro. */
export const THEME_BACKGROUNDS = [
  'plain',
  'cream',
  'tint',
  'gingham',
  'chalkboard',
  // Fotos reales (Poly Haven, CC0).
  'oak',
  'planks',
  'darkwood',
  'brick',
  'stone',
  'slate',
  'concrete',
  'jute',
  'stucco',
  'bamboo',
  'blackplanks',
  'bluewood',
  'greenwood',
  'parquet',
  'whitewood',
  'whitetiles',
  'terracotta',
  'stonewall',
  'clay',
  'metal',
  // De antes: la web los muestra como yute y tablones.
  'kraft',
  'wood',
] as const;

export interface StoreTheme {
  /** Estilo listo que se eligió, si fue así. Solo informativo. */
  preset?: string;
  /** Color principal, #rrggbb. */
  primary: string;
  mode: (typeof THEME_MODES)[number];
  font: (typeof THEME_FONTS)[number];
  corners: (typeof THEME_CORNERS)[number];
  /** Segundo color, #rrggbb: precios y el botón de agregar. Sin él, el principal. */
  accent?: string;
  /** Sin fondo elegido: liso. */
  background?: (typeof THEME_BACKGROUNDS)[number];
}

/**
 * Colores de la lista del editor (web/src/lib/theme.ts). Se sugieren cuando
 * el logo es blanco y negro y no tiene un color propio.
 */
export const THEME_COLORS = [
  '#0b5cff',
  '#0891b2',
  '#15803d',
  '#65a30d',
  '#c9a227',
  '#f97316',
  '#dc2626',
  '#db2777',
  '#a855f7',
  '#334155',
] as const;
export const DEFAULT_THEME: StoreTheme = {
  preset: 'fresh',
  primary: '#0b5cff',
  mode: 'light',
  font: 'modern',
  corners: 'round',
};

type Background = (typeof THEME_BACKGROUNDS)[number];
/** Los que se ofrecen (los de antes, `kraft` y `wood`, ya no). */
export type OfferedBackground = Exclude<Background, 'kraft' | 'wood'>;

/**
 * Qué evoca cada fondo y si es claro u oscuro (el modo de la tienda lo sigue).
 * Lo usa la sugerencia de diseño; debe coincidir con web/src/lib/theme.ts.
 */
export const BACKGROUND_INFO: Record<
  OfferedBackground,
  { mode: (typeof THEME_MODES)[number]; description: string }
> = {
  plain: { mode: 'light', description: 'liso claro, neutro y limpio' },
  cream: { mode: 'light', description: 'liso crema, cálido y suave' },
  tint: {
    mode: 'light',
    description: 'liso con un tono suave del color de la marca',
  },
  gingham: {
    mode: 'light',
    description: 'mantel de cuadros suaves: comida casera, italiana',
  },
  chalkboard: {
    mode: 'dark',
    description: 'pizarra verde oscura: bares, cafeterías, menú del día',
  },
  oak: {
    mode: 'light',
    description: 'madera clara: panaderías, cafeterías, natural',
  },
  planks: {
    mode: 'light',
    description: 'tablones de madera: restaurantes, comida casera',
  },
  darkwood: {
    mode: 'dark',
    description: 'madera oscura: bares, parrillas, elegante y cálido',
  },
  brick: {
    mode: 'dark',
    description: 'ladrillo rojo oscuro: pizzerías, bares',
  },
  stone: {
    mode: 'light',
    description: 'piedra travertino clara: restaurantes tradicionales',
  },
  slate: {
    mode: 'dark',
    description: 'piedra oscura: bares, cocteles, sobrio',
  },
  concrete: {
    mode: 'light',
    description: 'concreto gris: comidas rápidas, urbano, moderno',
  },
  jute: { mode: 'light', description: 'tela de yute: rústico, café de origen' },
  stucco: {
    mode: 'light',
    description: 'estuco blanco: minimalista, heladerías',
  },
  bamboo: { mode: 'light', description: 'bambú: sushi, comida asiática' },
  blackplanks: {
    mode: 'dark',
    description: 'tablas negras: bares, hamburgueserías',
  },
  bluewood: {
    mode: 'light',
    description: 'madera pintada de azul: mariscos, comida de playa',
  },
  greenwood: {
    mode: 'light',
    description: 'madera pintada de verde: comida saludable, jugos',
  },
  parquet: { mode: 'light', description: 'parqué en espiga: cafés elegantes' },
  whitewood: {
    mode: 'light',
    description: 'madera blanca: heladerías, cafés nórdicos',
  },
  whitetiles: {
    mode: 'light',
    description: 'azulejo blanco: heladerías, panaderías',
  },
  terracotta: {
    mode: 'dark',
    description: 'baldosa de barro rojiza: comida mexicana, tapas',
  },
  stonewall: {
    mode: 'light',
    description: 'muro de piedra: parrillas, asaderos',
  },
  clay: { mode: 'light', description: 'pared de barro: comida típica' },
  metal: {
    mode: 'light',
    description: 'lámina metálica: food trucks, industrial',
  },
};

/** Fondo de partida según el tipo de negocio, si no hay modelo que elija. */
const TYPE_BACKGROUND: Record<string, OfferedBackground> = {
  restaurant: 'planks',
  fast_food: 'concrete',
  bar: 'darkwood',
  cafe: 'oak',
  bakery: 'jute',
  ice_cream: 'whitewood',
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Fondo para el color de la marca y el tipo de negocio. Si el color no
 * destaca sobre ese fondo (muy claro en uno claro, muy oscuro en uno oscuro),
 * se usa uno del otro modo.
 */
export function backgroundFor(
  businessType: string | null,
  primary: string,
): OfferedBackground {
  const preferred = TYPE_BACKGROUND[businessType ?? ''] ?? 'plain';
  const l = luminance(primary);
  const mode = BACKGROUND_INFO[preferred].mode;
  if (mode === 'light' && l > 0.55) return 'slate';
  if (mode === 'dark' && l < 0.08) return 'cream';
  return preferred;
}
