import type { BusinessType } from '../businesses/business-type.js';

/**
 * Cuestionario del creador de logos (prototipo en docs/logo-lab). Solo datos:
 * la web lo pinta como tarjetas y el prompt se arma con los fragmentos en
 * inglés (`en`) de cada opción, sin un modelo intermedio.
 */
export interface LogoOption {
  id: string;
  label: string;
  /** Fragmento para el prompt de imagen. No se envía a la web. */
  en: string;
  /** Muestras de color (paletas). */
  colors?: string[];
}

export const BUSINESS_PROMPT: Record<BusinessType, string> = {
  restaurant: 'restaurant',
  fast_food: 'fast food restaurant',
  bar: 'bar',
  cafe: 'coffee shop',
  bakery: 'bakery and pastry shop',
  ice_cream: 'ice cream shop',
};

/** Dibujos sugeridos por tipo de negocio; se eligen hasta 2. */
export const SYMBOLS: Record<BusinessType, LogoOption[]> = {
  restaurant: [
    { id: 'cubiertos', label: 'Cubiertos', en: 'fork and knife' },
    { id: 'plato', label: 'Plato servido', en: 'plate with a dish' },
    { id: 'chef', label: 'Gorro de chef', en: 'chef hat' },
    { id: 'fuego', label: 'Llama o parrilla', en: 'flame' },
    { id: 'olla', label: 'Olla', en: 'cooking pot' },
  ],
  fast_food: [
    { id: 'hamburguesa', label: 'Hamburguesa', en: 'burger' },
    { id: 'pizza', label: 'Pizza', en: 'pizza slice' },
    { id: 'papas', label: 'Papas fritas', en: 'fries' },
    { id: 'perro', label: 'Perro caliente', en: 'hot dog' },
    { id: 'fuego', label: 'Llama', en: 'flame' },
  ],
  bar: [
    { id: 'copa', label: 'Copa', en: 'cocktail glass' },
    { id: 'cerveza', label: 'Cerveza', en: 'beer mug' },
    { id: 'botella', label: 'Botella', en: 'bottle' },
    { id: 'luna', label: 'Luna', en: 'crescent moon' },
    { id: 'rayo', label: 'Rayo', en: 'lightning bolt' },
  ],
  cafe: [
    { id: 'taza', label: 'Taza de café', en: 'coffee cup' },
    { id: 'grano', label: 'Grano de café', en: 'coffee bean' },
    { id: 'vapor', label: 'Vapor', en: 'steam swirl' },
    { id: 'croissant', label: 'Croissant', en: 'croissant' },
    { id: 'montana', label: 'Montaña', en: 'mountain' },
  ],
  bakery: [
    { id: 'pan', label: 'Pan', en: 'loaf of bread' },
    { id: 'trigo', label: 'Espiga de trigo', en: 'wheat ear' },
    { id: 'cupcake', label: 'Cupcake', en: 'cupcake' },
    { id: 'rodillo', label: 'Rodillo', en: 'rolling pin' },
    { id: 'torta', label: 'Torta', en: 'layer cake' },
  ],
  ice_cream: [
    { id: 'cono', label: 'Cono de helado', en: 'ice cream cone' },
    { id: 'paleta', label: 'Paleta', en: 'popsicle' },
    { id: 'copa', label: 'Copa de helado', en: 'sundae cup' },
    { id: 'fresa', label: 'Fresa', en: 'strawberry' },
    { id: 'chispas', label: 'Chispas de colores', en: 'sprinkles' },
  ],
};

export const FORMATS: LogoOption[] = [
  {
    id: 'simbolo_nombre',
    label: 'Un dibujo y el nombre',
    en: 'a symbol above or beside the business name (combination mark)',
  },
  {
    id: 'sello',
    label: 'Un sello redondo',
    en: 'a circular badge / emblem with the name inside and a small symbol',
  },
  {
    id: 'solo_nombre',
    label: 'Solo el nombre con letra bonita',
    en: 'a wordmark: only the business name in custom lettering, no symbol',
  },
  {
    id: 'iniciales',
    label: 'Las iniciales',
    en: 'a monogram made of the initials of the name',
  },
  {
    id: 'solo_dibujo',
    label: 'Solo un dibujo, sin letras',
    en: 'a symbol only, with no text at all',
  },
];

/** Formatos sin dibujo: se salta el paso de elegirlo. */
export const NO_SYMBOL_FORMATS = ['solo_nombre', 'iniciales'];

export const STYLES: LogoOption[] = [
  {
    id: 'minimalista',
    label: 'Simple y limpio',
    en: 'minimalist, flat vector, clean lines, lots of negative space',
  },
  {
    id: 'vintage',
    label: 'Clásico o retro',
    en: 'vintage retro style, classic badge feel, serif lettering',
  },
  {
    id: 'dibujado',
    label: 'Dibujado a mano',
    en: 'hand-drawn illustration, organic lines, friendly brush lettering',
  },
  {
    id: 'elegante',
    label: 'Elegante',
    en: 'elegant luxury branding, thin lines, refined serif typography, gold accents feel',
  },
  {
    id: 'divertido',
    label: 'Divertido y colorido',
    en: 'playful cartoon mascot style, rounded shapes, bold friendly lettering',
  },
  {
    id: 'geometrico',
    label: 'Moderno',
    en: 'modern geometric shapes, sans-serif typography, clean',
  },
  {
    id: 'rustico',
    label: 'Rústico o artesanal',
    en: 'rustic craft style, woodcut texture feel, stamp-like look',
  },
  {
    id: 'audaz',
    label: 'Fuerte y urbano',
    en: 'bold street style, heavy thick lines, high contrast, strong typography',
  },
];

export const PALETTES: LogoOption[] = [
  {
    id: 'calidos',
    label: 'Rojo y amarillo',
    colors: ['#C62828', '#F9A825', '#FFF8E1'],
    en: 'warm red and mustard yellow on cream',
  },
  {
    id: 'tierra',
    label: 'Café y crema',
    colors: ['#5D4037', '#D7B98E', '#FFF3E0'],
    en: 'coffee brown and warm beige',
  },
  {
    id: 'naturaleza',
    label: 'Verdes',
    colors: ['#2E7D32', '#A5D6A7', '#F1F8E9'],
    en: 'fresh green and light sage',
  },
  {
    id: 'oscuro_dorado',
    label: 'Negro y dorado',
    colors: ['#111111', '#C9A227', '#FAFAFA'],
    en: 'black and metallic gold',
  },
  {
    id: 'azul',
    label: 'Azul y blanco',
    colors: ['#1565C0', '#90CAF9', '#FFFFFF'],
    en: 'navy blue and white',
  },
  {
    id: 'rosa',
    label: 'Rosa y morado',
    colors: ['#AD1457', '#F8BBD0', '#F3E5F5'],
    en: 'rose pink and soft purple',
  },
  {
    id: 'naranja',
    label: 'Naranja y negro',
    colors: ['#EF6C00', '#212121', '#FFFFFF'],
    en: 'vivid orange and black',
  },
  {
    id: 'bn',
    label: 'Blanco y negro',
    colors: ['#000000', '#9E9E9E', '#FFFFFF'],
    en: 'strictly black and white, no other colors',
  },
  {
    id: 'ia',
    label: 'Que lo elija la IA',
    colors: ['#B0BEC5', '#CFD8DC', '#ECEFF1'],
    en: 'a color palette that fits the business type (max 3 colors)',
  },
];

export const PERSONALITIES: LogoOption[] = [
  { id: 'familiar', label: 'Familiar y cercano', en: 'warm, family-friendly' },
  { id: 'premium', label: 'De lujo', en: 'premium, upscale' },
  { id: 'joven', label: 'Joven y moderno', en: 'young, trendy' },
  { id: 'tradicional', label: 'Tradicional', en: 'traditional, trustworthy' },
  {
    id: 'saludable',
    label: 'Saludable y natural',
    en: 'fresh, healthy, natural',
  },
  { id: 'divertido', label: 'Divertido', en: 'fun, energetic' },
  { id: 'artesanal', label: 'Hecho a mano', en: 'handcrafted, authentic' },
];

/** Lo que recibe la web: sin los fragmentos del prompt. */
export function publicQuestionnaire() {
  const strip = ({ en: _en, ...rest }: LogoOption) => rest;
  return {
    formats: FORMATS.map(strip),
    noSymbolFormats: NO_SYMBOL_FORMATS,
    symbols: Object.fromEntries(
      Object.entries(SYMBOLS).map(([type, list]) => [type, list.map(strip)]),
    ) as Record<BusinessType, Omit<LogoOption, 'en'>[]>,
    styles: STYLES.map(strip),
    palettes: PALETTES.map(strip),
    personalities: PERSONALITIES.map(strip),
    limits: { maxSymbols: 2, maxPersonalities: 3, maxText: 120 },
  };
}
