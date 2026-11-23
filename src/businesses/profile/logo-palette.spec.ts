import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { extractLogoPalette } from './logo-palette.js';

/** Logo de prueba: fondo de un color con un recuadro de otro. */
async function logo(background: string, mark: string, alpha = 1) {
  const square = await sharp({
    create: { width: 40, height: 40, channels: 4, background: mark },
  })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { ...hex(background), alpha },
    },
  })
    .composite([{ input: square, left: 30, top: 30 }])
    .png()
    .toBuffer();
}

function hex(value: string) {
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

describe('extractLogoPalette', () => {
  it('devuelve el color exacto del logo e ignora el fondo blanco', async () => {
    const palette = await extractLogoPalette(await logo('#ffffff', '#dc2626'));
    expect(palette.colors).toEqual(['#dc2626']);
    expect(palette.monochrome).toBe(false);
    expect(palette.lightness).toBeGreaterThan(0.5);
  });

  it('ordena por lo que más ocupa', async () => {
    const palette = await extractLogoPalette(await logo('#15803d', '#f97316'));
    expect(palette.colors).toEqual(['#15803d', '#f97316']);
  });

  it('ignora lo transparente', async () => {
    const palette = await extractLogoPalette(
      await logo('#0b5cff', '#c9a227', 0),
    );
    expect(palette.colors).toEqual(['#c9a227']);
  });

  it('reconoce un logo en blanco y negro', async () => {
    const palette = await extractLogoPalette(await logo('#000000', '#ffffff'));
    expect(palette.colors).toEqual([]);
    expect(palette.monochrome).toBe(true);
    expect(palette.lightness).toBeLessThan(0.5);
  });
});
