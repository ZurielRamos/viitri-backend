import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cleanDraft } from './menu-import.service.js';
import { toMenuParts, type UploadedMenuFile } from './menu-sources.js';

const file = (
  name: string,
  mimetype: string,
  buffer: Buffer,
): UploadedMenuFile => ({
  originalname: name,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('cargar el menú: limpieza del borrador', () => {
  it('redondea precios, quita repetidos y categorías vacías, y prefiere los tamaños', () => {
    const draft = cleanDraft({
      categories: [
        {
          name: ' Hamburguesas ',
          items: [
            {
              name: 'Sencilla',
              description: '  Carne y queso ',
              price: 15000.4,
              variants: [],
            },
            { name: 'sencilla', description: null, price: 15000, variants: [] },
            {
              name: 'Doble',
              description: null,
              price: 20000,
              variants: [
                { name: 'Personal', price: 18000 },
                { name: '', price: 1 },
              ],
            },
            { name: 'Sin precio', description: null, price: -5, variants: [] },
          ],
        },
        { name: 'Vacía', items: [] },
      ],
      notes: '  ',
    });
    expect(draft.notes).toBeNull();
    expect(draft.categories).toHaveLength(1);
    const [category] = draft.categories;
    expect(category.name).toBe('Hamburguesas');
    expect(category.items.map((i) => i.name)).toEqual([
      'Sencilla',
      'Doble',
      'Sin precio',
    ]);
    expect(category.items[0]).toMatchObject({
      price: 15000,
      description: 'Carne y queso',
    });
    // Con tamaños, el precio único se descarta.
    expect(category.items[1]).toMatchObject({
      price: null,
      variants: [{ name: 'Personal', price: 18000 }],
    });
    expect(category.items[2].price).toBeNull();
  });
});

describe('cargar el menú: lectura de archivos', () => {
  it('pasa un CSV y el texto pegado como texto', async () => {
    const parts = await toMenuParts(
      [
        file(
          'carta.csv',
          'text/csv',
          Buffer.from('Producto,Precio\nPerro sencillo,8000'),
        ),
      ],
      'Gaseosa 3000',
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'text' });
    expect((parts[0] as { text: string }).text).toContain(
      'Perro sencillo,8000',
    );
    expect((parts[1] as { text: string }).text).toContain('Gaseosa 3000');
  });

  it('convierte una hoja de Excel en filas', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Menú');
    sheet.addRow(['Producto', 'Precio']);
    sheet.addRow(['Salchipapa', 12000]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const [part] = await toMenuParts([
      file(
        'menu.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      ),
    ]);
    expect((part as { text: string }).text).toContain('Salchipapa | 12000');
  });

  it('achica las fotos y deja los PDF para el modelo', async () => {
    const photo = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const parts = await toMenuParts([
      file('carta.png', 'image/png', photo),
      file('carta.pdf', 'application/pdf', Buffer.from('%PDF-1.4')),
    ]);
    expect(parts[0]).toMatchObject({ type: 'image', mediaType: 'image/jpeg' });
    const meta = await sharp((parts[0] as { image: Buffer }).image).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      2048,
    );
    expect(parts[1]).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
    });
  });

  it('explica qué hacer con formatos viejos o desconocidos, y sin nada', async () => {
    await expect(
      toMenuParts([file('carta.doc', 'application/msword', Buffer.from('x'))]),
    ).rejects.toThrow(/\.docx/);
    await expect(
      toMenuParts([file('carta.zip', 'application/zip', Buffer.from('x'))]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(toMenuParts([])).rejects.toBeInstanceOf(BadRequestException);
  });
});
