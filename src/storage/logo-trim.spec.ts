import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { tightenLogo } from './logo-trim.js';

/** Lienzo blanco con un rectángulo negro en el centro. */
async function canvas(side: number, mark: { w: number; h: number }) {
  const markPng = await sharp({
    create: {
      width: mark.w,
      height: mark.h,
      channels: 3,
      background: '#000000',
    },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: side, height: side, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: markPng, gravity: 'centre' }])
    .png()
    .toBuffer();
}

describe('tightenLogo', () => {
  it('quita el borde vacío y deja el logo cuadrado con poco margen', async () => {
    const out = await tightenLogo(await canvas(1000, { w: 400, h: 200 }));
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBeGreaterThan(400);
    expect(meta.width).toBeLessThan(500);
  });

  it('deja igual un logo que ya ocupa casi todo el espacio', async () => {
    const input = await canvas(500, { w: 480, h: 480 });
    expect(await tightenLogo(input)).toBe(input);
  });

  it('deja igual algo que no es una imagen', async () => {
    const input = Buffer.from('no es una imagen');
    expect(await tightenLogo(input)).toBe(input);
  });
});
