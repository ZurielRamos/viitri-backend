import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ItemKind, PriceType } from '../catalog/catalog.enums.js';
import type { Item } from '../catalog/entities/item.entity.js';
import { OrderPricingService } from './order-pricing.service.js';

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    name: null,
    price: 15000,
    compareAtPrice: null,
    stock: null,
    isAvailable: true,
    sortOrder: 0,
    ...overrides,
  };
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    kind: ItemKind.Product,
    name: 'Hamburguesa',
    priceType: PriceType.Fixed,
    isActive: true,
    isAvailable: true,
    category: null,
    variants: [variant()],
    optionGroupLinks: [],
    ...overrides,
  } as unknown as Item;
}

function service(items: Item[]) {
  const repo = { find: () => Promise.resolve(items) };
  return new OrderPricingService(repo as unknown as Repository<Item>);
}

describe('OrderPricingService', () => {
  it('con una sola presentación no hace falta elegirla', async () => {
    const [line] = await service([item()]).price('b1', [
      { itemId: 'i1', quantity: 2 },
    ]);
    expect(line).toMatchObject({
      itemId: 'i1',
      variantId: 'v1',
      variantName: null,
      unitCents: 1_500_000,
      lineCents: 3_000_000,
      tracksStock: false,
    });
  });

  it('con varias, usa la elegida y exige elegir', async () => {
    const pizza = item({
      name: 'Pizza',
      variants: [
        variant({ id: 'p', name: 'Personal', price: 20000 }),
        variant({ id: 'f', name: 'Familiar', price: 45000 }),
      ],
    });
    const [line] = await service([pizza]).price('b1', [
      { itemId: 'i1', variantId: 'f', quantity: 1 },
    ]);
    expect(line).toMatchObject({
      variantName: 'Familiar',
      unitCents: 4_500_000,
    });
    await expect(
      service([pizza]).price('b1', [{ itemId: 'i1', quantity: 1 }]),
    ).rejects.toThrow(/Elige la presentación/);
  });

  it('respeta el inventario', async () => {
    const limited = item({ variants: [variant({ stock: 2 })] });
    const [line] = await service([limited]).price('b1', [
      { itemId: 'i1', quantity: 2 },
    ]);
    expect(line.tracksStock).toBe(true);
    await expect(
      service([limited]).price('b1', [{ itemId: 'i1', quantity: 3 }]),
    ).rejects.toThrow(/Solo quedan 2/);
    await expect(
      service([item({ variants: [variant({ stock: 0 })] })]).price('b1', [
        { itemId: 'i1', quantity: 1 },
      ]),
    ).rejects.toThrow(/agotado/);
  });

  it('los servicios, los planes y lo que se cotiza no se piden', async () => {
    for (const blocked of [
      item({ kind: ItemKind.Service }),
      item({ kind: ItemKind.Plan }),
      item({ priceType: PriceType.OnRequest }),
    ]) {
      await expect(
        service([blocked]).price('b1', [{ itemId: 'i1', quantity: 1 }]),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('lo gratis cuesta 0', async () => {
    const [line] = await service([item({ priceType: PriceType.Free })]).price(
      'b1',
      [{ itemId: 'i1', quantity: 1 }],
    );
    expect(line.unitCents).toBe(0);
  });

  it('cuenta las repeticiones de cada opción en el límite del grupo', async () => {
    const cheese = {
      id: 'q',
      name: 'Queso',
      priceDelta: 2000,
      maxQuantity: 3,
      isAvailable: true,
      sortOrder: 0,
    };
    const bacon = {
      id: 't',
      name: 'Tocineta',
      priceDelta: 3000,
      maxQuantity: 1,
      isAvailable: true,
      sortOrder: 1,
    };
    const burger = item({
      optionGroupLinks: [
        {
          groupId: 'g',
          sortOrder: 0,
          group: {
            id: 'g',
            name: 'Adicionales',
            minSelect: 0,
            maxSelect: 3,
            options: [cheese, bacon],
          },
        },
      ],
    });
    const [line] = await service([burger]).price('b1', [
      {
        itemId: 'i1',
        quantity: 1,
        options: [{ optionId: 'q', quantity: 2 }, { optionId: 't' }],
      },
    ]);
    expect(line.unitCents).toBe(1_500_000 + 2 * 200_000 + 300_000);
    expect(line.options).toMatchObject([
      { optionName: 'Queso', quantity: 2 },
      { optionName: 'Tocineta', quantity: 1 },
    ]);
    await expect(
      service([burger]).price('b1', [
        {
          itemId: 'i1',
          quantity: 1,
          options: [{ optionId: 't', quantity: 2 }],
        },
      ]),
    ).rejects.toThrow(/máximo 1 vez/);
    await expect(
      service([burger]).price('b1', [
        {
          itemId: 'i1',
          quantity: 1,
          options: [{ optionId: 'q', quantity: 3 }, { optionId: 't' }],
        },
      ]),
    ).rejects.toThrow(/máximo 3/);
  });
});
