import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BusinessFeature as F } from '../businesses/business-feature.enum.js';
import { ItemKind, enabledKinds } from './catalog.enums.js';
import { thumbKey } from './catalog-images.service.js';
import { assertVariants, lowestPrice } from './items.service.js';

describe('enabledKinds', () => {
  it('cada tipo se habilita con alguna de sus funcionalidades', () => {
    expect(enabledKinds([F.Menu])).toEqual([ItemKind.Product]);
    expect(enabledKinds([F.Ecommerce, F.Bookings])).toEqual([
      ItemKind.Product,
      ItemKind.Service,
    ]);
    expect(enabledKinds([F.Memberships])).toEqual([ItemKind.Plan]);
    expect(enabledKinds([F.Reviews])).toEqual([]);
  });
});

describe('assertVariants', () => {
  it('acepta una sola variante sin nombre', () => {
    expect(() => assertVariants([{ price: 15000 }])).not.toThrow();
  });

  it('con varias, exige nombres distintos', () => {
    expect(() =>
      assertVariants([{ price: 1, name: 'Personal' }, { price: 2 }]),
    ).toThrow(BadRequestException);
    expect(() =>
      assertVariants([
        { price: 1, name: 'Personal' },
        { price: 2, name: ' personal ' },
      ]),
    ).toThrow(/mismo nombre/);
    expect(() =>
      assertVariants([
        { price: 1, name: 'Personal' },
        { price: 2, name: 'Familiar' },
      ]),
    ).not.toThrow();
  });

  it('el precio de antes debe ser mayor', () => {
    expect(() => assertVariants([{ price: 100, compareAtPrice: 100 }])).toThrow(
      /precio de antes/,
    );
    expect(() =>
      assertVariants([{ price: 100, compareAtPrice: 120 }]),
    ).not.toThrow();
  });
});

describe('lowestPrice', () => {
  it('es el de la variante más barata', () => {
    expect(lowestPrice([{ price: 30 }, { price: 12.5 }, { price: 20 }])).toBe(
      12.5,
    );
    expect(lowestPrice([])).toBe(0);
  });
});

describe('thumbKey', () => {
  it('la miniatura va junto a la foto', () => {
    expect(thumbKey('businesses/b/items/a.webp')).toBe(
      'businesses/b/items/a-thumb.webp',
    );
  });
});
