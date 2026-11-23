import sharp from 'sharp';

export interface LogoPalette {
  /** Colores vivos del logo, #rrggbb, del que más ocupa al que menos. */
  colors: string[];
  /** El logo es casi todo blanco, negro o gris. */
  monochrome: boolean;
  /** Luminancia media (0 a 1) de lo visible del logo: sirve para elegir el fondo. */
  lightness: number;
}

const SIDE = 64;
interface Shade {
  n: number;
  r: number;
  g: number;
  b: number;
}
/** Tono en 24 grupos de 15°. */
const HUE_GROUPS = 24;
/** Menos de este porcentaje de los píxeles vivos es un detalle, no un color del logo. */
const MIN_SHARE = 0.06;
/** Distancia RGB por debajo de la cual dos colores se ven iguales. */
const SAME_COLOR = 48;

/**
 * Colores exactos del logo. Se reduce a 64×64 y se agrupan los píxeles por
 * tono, descartando transparentes, blancos, negros y grises. El resultado son
 * los colores reales del logo, no aproximaciones.
 */
export async function extractLogoPalette(image: Buffer): Promise<LogoPalette> {
  const { data, info } = await sharp(image)
    // nearest: cada píxel conserva un color real del logo, sin mezclas.
    .resize(SIDE, SIDE, { fit: 'inside', kernel: 'nearest' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // En cada tono, los píxeles casi iguales van juntos: el borde suavizado
  // de las letras no debe correr el color hacia el fondo.
  const groups = Array.from({ length: HUE_GROUPS }, () => ({
    score: 0,
    n: 0,
    shades: new Map<number, Shade>(),
  }));
  let visible = 0;
  let vivid = 0;
  let lightSum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    visible += 1;
    lightSum += luminance(r, g, b);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < 0.3 || max < 45 || min > 230) continue;
    vivid += 1;
    const group = groups[Math.round(hue(r, g, b) / 15) % HUE_GROUPS];
    group.score += 1 + saturation;
    group.n += 1;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const shade = group.shades.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    shade.n += 1;
    shade.r += r;
    shade.g += g;
    shade.b += b;
    group.shades.set(key, shade);
  }

  const colors: { hex: string; rgb: [number, number, number] }[] = [];
  for (const group of groups
    .filter((g) => vivid > 0 && g.n / vivid >= MIN_SHARE)
    .sort((a, b) => b.score - a.score)) {
    // El tono más repetido del grupo es el color real del logo.
    const top = [...group.shades.values()].sort((a, b) => b.n - a.n)[0];
    const rgb: [number, number, number] = [
      top.r / top.n,
      top.g / top.n,
      top.b / top.n,
    ];
    if (colors.some((c) => distance(c.rgb, rgb) < SAME_COLOR)) continue;
    colors.push({ hex: toHex(rgb), rgb });
    if (colors.length === 5) break;
  }

  return {
    colors: colors.map((c) => c.hex),
    monochrome: visible === 0 || vivid / visible < 0.04,
    lightness: visible ? round(lightSum / visible) : 1,
  };
}

/** Luminancia relativa (WCAG). */
function luminance(r: number, g: number, b: number): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function hue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return h * 60;
}

function distance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.min(255, Math.round(v)).toString(16).padStart(2, '0')).join('')}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
