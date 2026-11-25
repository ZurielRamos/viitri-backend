import sharp from 'sharp';

/** Margen que se deja alrededor del logo, en proporción a su lado mayor. */
const MARGIN = 0.08;
/** Solo se recorta si el borde vacío es grande (el logo ocupa menos del 85 %). */
const MIN_GAIN = 0.85;

/**
 * Quita el borde vacío alrededor de un logo (del color de su esquina:
 * blanco, transparente o el fondo que tenga) y lo deja cuadrado con un
 * margen chico. Los logos hechos con IA suelen venir con mucho aire, y en
 * el avatar redondo y el favicon se ven diminutos. Si no hay borde que
 * quitar, o algo falla, devuelve la imagen tal cual.
 */
export async function tightenLogo(file: Buffer): Promise<Buffer> {
  try {
    const source = sharp(file).rotate();
    const { width, height } = await source.metadata();
    if (!width || !height) return file;
    const { data, info } = await source
      .clone()
      .trim({ threshold: 18 })
      .toBuffer({ resolveWithObject: true });
    const side = Math.max(info.width, info.height);
    // Sin borde que valga la pena, o casi todo era borde (una imagen vacía).
    if (side >= Math.max(width, height) * MIN_GAIN || side < 16) return file;
    // El fondo para rellenar: el color de la esquina, con su transparencia.
    const { data: corner, info: cornerInfo } = await sharp(file)
      .rotate()
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const background =
      cornerInfo.channels >= 4
        ? { r: corner[0], g: corner[1], b: corner[2], alpha: corner[3] / 255 }
        : { r: 255, g: 255, b: 255, alpha: 1 };
    const target = Math.round(side * (1 + MARGIN * 2));
    const left = Math.floor((target - info.width) / 2);
    const top = Math.floor((target - info.height) / 2);
    return await sharp(data)
      .extend({
        left,
        right: target - info.width - left,
        top,
        bottom: target - info.height - top,
        background,
      })
      .png()
      .toBuffer();
  } catch {
    return file;
  }
}
