import sharp from 'sharp';

/**
 * Íconos de la tienda hechos de su logo: favicon (32), iPhone (180), app
 * instalable (192 y 512) y adaptable (Android lo recorta en círculo). Fondo
 * blanco, porque iOS pinta de negro lo transparente.
 */
export const APP_ICON_VARIANTS = [
  '32',
  '180',
  '192',
  '512',
  'maskable',
] as const;
export type AppIconVariant = (typeof APP_ICON_VARIANTS)[number];

/** Clave de un ícono junto a la del logo: logo-{id}.webp → logo-{id}-icon-192.png. */
export function appIconKey(logoKey: string, variant: AppIconVariant): string {
  return logoKey.replace(/\.webp$/, `-icon-${variant}.png`);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

export async function buildAppIcons(
  logo: Buffer,
): Promise<{ variant: AppIconVariant; png: Buffer }[]> {
  const square = (size: number) =>
    sharp(logo)
      .resize(size, size, { fit: 'contain', background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toBuffer();
  // Adaptable: el logo ocupa el 70 % del centro (zona segura).
  const maskable = sharp({
    create: { width: 512, height: 512, channels: 4, background: WHITE },
  })
    .composite([{ input: await square(358), gravity: 'center' }])
    .png()
    .toBuffer();
  const [s32, s180, s192, s512, mask] = await Promise.all([
    square(32),
    square(180),
    square(192),
    square(512),
    maskable,
  ]);
  return [
    { variant: '32', png: s32 },
    { variant: '180', png: s180 },
    { variant: '192', png: s192 },
    { variant: '512', png: s512 },
    { variant: 'maskable', png: mask },
  ];
}
