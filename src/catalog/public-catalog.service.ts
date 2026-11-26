import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ItemKind } from './catalog.enums.js';
import { Category } from './entities/category.entity.js';
import { Item } from './entities/item.entity.js';
import type { Variant } from './entities/variant.entity.js';
import { lowestPrice } from './items.service.js';
import { PromotionsService } from './promotions.service.js';

/** Se puede pedir: disponible y, si lleva inventario, con unidades. */
const inStock = (v: Variant) =>
  v.isAvailable && (v.stock === null || v.stock > 0);

/** Catálogo tal como lo ve el público: solo lo activo, ya ordenado. */
@Injectable()
export class PublicCatalogService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Item)
    private readonly items: Repository<Item>,
    private readonly promotions: PromotionsService,
  ) {}

  async get(businessId: string, kinds: ItemKind[]) {
    const [categories, items, promotions] = await Promise.all([
      this.categories.find({
        where: { businessId, isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      this.items.find({
        where: { businessId, isActive: true, kind: In(kinds) },
        // Una consulta por relación en vez de un solo JOIN: con variantes,
        // grupos y opciones, el JOIN multiplica las filas (productos ×
        // variantes × opciones) y tardaba segundos con un menú normal.
        relationLoadStrategy: 'query',
        relations: {
          variants: true,
          optionGroupLinks: { group: { options: true } },
          service: true,
          plan: { benefits: true },
        },
        order: {
          sortOrder: 'ASC',
          name: 'ASC',
          variants: { sortOrder: 'ASC' },
          optionGroupLinks: {
            sortOrder: 'ASC',
            group: { options: { sortOrder: 'ASC' } },
          },
          plan: { benefits: { sortOrder: 'ASC' } },
        },
      }),
      // Las activas (no pausadas), con su horario y si aplican ahora.
      this.promotions
        .list(businessId)
        .then((list) => list.filter((p) => p.isActive)),
    ]);

    // El stock exacto no se publica: solo si hay o no.
    const toPublic = (i: Item) => ({
      id: i.id,
      kind: i.kind,
      name: i.name,
      slug: i.slug,
      description: i.description,
      priceType: i.priceType,
      price: lowestPrice(i.variants),
      imageUrls: i.imageUrls,
      isAvailable: i.isAvailable && i.variants.some(inStock),
      variants: i.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        isAvailable: inStock(v),
      })),
      optionGroups: i.optionGroupLinks.map(({ group }) => ({
        id: group.id,
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: o.priceDelta,
          maxQuantity: o.maxQuantity,
          isAvailable: o.isAvailable,
        })),
      })),
      service: i.service && {
        durationMinutes: i.service.durationMinutes,
      },
      plan: i.plan && {
        interval: i.plan.interval,
        intervalCount: i.plan.intervalCount,
        trialDays: i.plan.trialDays,
        benefits: i.plan.benefits.map((b) => ({
          label: b.label,
          quantity: b.quantity,
        })),
      },
    });

    const byCategory = new Map<string | null, Item[]>();
    for (const item of items) {
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }
    // Una categoría inactiva oculta también sus elementos; las vacías no se muestran.
    return {
      categories: categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          icon: c.icon,
          displayMode: c.displayMode,
          showInBar: c.showInBar,
          items: (byCategory.get(c.id) ?? []).map(toPublic),
        }))
        .filter((c) => c.items.length > 0),
      uncategorized: (byCategory.get(null) ?? []).map(toPublic),
      promotions: promotions.map((p) => ({
        id: p.id,
        name: p.name,
        percent: p.percent,
        days: p.days,
        startTime: p.startTime,
        endTime: p.endTime,
        categoryIds: p.categoryIds,
        itemIds: p.itemIds,
        liveNow: p.liveNow,
      })),
    };
  }
}
