import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import {
  DataSource,
  In,
  IsNull,
  Not,
  Repository,
  type EntityManager,
} from 'typeorm';
import { BusinessFeaturesService } from '../businesses/features/business-features.service.js';
import { toCents } from '../common/money.js';
import { escapeLike } from '../common/sql.js';
import { CatalogImagesService } from './catalog-images.service.js';
import { ItemKind, KIND_FEATURES, enabledKinds } from './catalog.enums.js';
import { firstFreeSlug, slugifyName } from './item-slug.js';
import type {
  CreateItemDto,
  ListItemsQueryDto,
  PlanDetailsDto,
  UpdateItemDto,
  VariantInputDto,
} from './dto/catalog.dto.js';
import { Category } from './entities/category.entity.js';
import { ItemOptionGroup } from './entities/item-option-group.entity.js';
import { Item } from './entities/item.entity.js';
import { PlanBenefit } from './entities/plan-benefit.entity.js';
import { PlanDetails } from './entities/plan-details.entity.js';
import { ServiceDetails } from './entities/service-details.entity.js';
import { Variant } from './entities/variant.entity.js';
import { OptionGroupsService } from './option-groups.service.js';

const NOT_FOUND = 'Elemento no encontrado.';
const KIND_LABEL: Record<ItemKind, string> = {
  [ItemKind.Product]: 'productos',
  [ItemKind.Service]: 'servicios',
  [ItemKind.Plan]: 'planes',
};
const SIMPLE_FIELDS = [
  'name',
  'description',
  'priceType',
  'categoryId',
  'imageUrls',
  'sortOrder',
  'isActive',
  'isAvailable',
] as const;

/** Elemento con sus variantes, opciones y detalle, listo para responder. */
export type ItemView = Omit<Item, 'optionGroupLinks'> & {
  /** El precio más bajo de sus variantes. */
  price: number;
  optionGroups: ItemOptionGroup['group'][];
};

/**
 * Productos, servicios y planes del negocio. Cada tipo exige una de sus
 * funcionalidades activa (KIND_FEATURES). Siempre hay al menos una variante.
 */
@Injectable()
export class ItemsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Item)
    private readonly items: Repository<Item>,
    private readonly optionGroups: OptionGroupsService,
    private readonly features: BusinessFeaturesService,
    private readonly catalogImages: CatalogImagesService,
  ) {}

  async list(businessId: string, query: ListItemsQueryDto) {
    const qb = this.items
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.variants', 'v')
      // Duración y tiempo entre citas de los servicios (nulo en los demás).
      .leftJoinAndSelect('i.service', 's')
      .leftJoinAndSelect('i.optionGroupLinks', 'l')
      .leftJoinAndSelect('l.group', 'g')
      .leftJoinAndSelect('g.options', 'o')
      .where('i.businessId = :businessId', { businessId })
      .orderBy('i.sortOrder', 'ASC')
      .addOrderBy('i.name', 'ASC')
      .addOrderBy('v.sortOrder', 'ASC')
      .addOrderBy('l.sortOrder', 'ASC')
      .addOrderBy('o.sortOrder', 'ASC')
      .skip(query.skip)
      .take(query.limit);
    if (query.categoryId === 'none') {
      qb.andWhere('i.categoryId IS NULL');
    } else if (query.categoryId) {
      if (!isUUID(query.categoryId)) {
        throw new BadRequestException('categoryId debe ser un UUID o "none".');
      }
      qb.andWhere('i.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.kind) qb.andWhere('i.kind = :kind', { kind: query.kind });
    if (query.q) {
      qb.andWhere('i.name ILIKE :term', { term: `%${escapeLike(query.q)}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return {
      // Como en el detalle: los grupos de opciones, en orden, sin la tabla intermedia.
      items: items.map(({ optionGroupLinks, ...item }) => ({
        ...item,
        price: lowestPrice(item.variants),
        optionGroups: optionGroupLinks.map((l) => l.group),
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOneOrFail(businessId: string, id: string): Promise<ItemView> {
    const item = await this.items.findOne({
      where: { id, businessId },
      relations: {
        variants: true,
        optionGroupLinks: { group: { options: true } },
        service: true,
        plan: { benefits: true },
      },
      order: {
        variants: { sortOrder: 'ASC' },
        optionGroupLinks: {
          sortOrder: 'ASC',
          group: { options: { sortOrder: 'ASC' } },
        },
        plan: { benefits: { sortOrder: 'ASC' } },
      },
    });
    if (!item) throw new NotFoundException(NOT_FOUND);
    const { optionGroupLinks, ...rest } = item;
    return {
      ...rest,
      price: lowestPrice(item.variants),
      optionGroups: optionGroupLinks.map((l) => l.group),
    };
  }

  async create(businessId: string, dto: CreateItemDto): Promise<ItemView> {
    const kind = dto.kind ?? ItemKind.Product;
    await this.assertKindEnabled(businessId, kind);
    assertDetailsMatchKind(kind, dto);
    if (kind === ItemKind.Service && !dto.service) {
      throw new BadRequestException('Indica cuánto dura el servicio.');
    }
    if (kind === ItemKind.Plan && !dto.plan) {
      throw new BadRequestException('Indica cada cuánto se cobra el plan.');
    }
    if ((dto.price === undefined) === (dto.variants === undefined)) {
      throw new BadRequestException(
        'Envía el precio (price) o las presentaciones (variants), no ambos.',
      );
    }
    const variants = dto.variants ?? [
      { price: dto.price!, compareAtPrice: dto.compareAtPrice ?? null },
    ];
    assertVariants(variants);
    await this.assertReferences(businessId, dto, null);

    const id = await retryOnSlugConflict(() =>
      this.dataSource.transaction(async (manager) => {
        const item = await manager.save(
          manager.create(Item, {
            businessId,
            kind,
            name: dto.name,
            slug: await this.freeSlug(manager, businessId, dto.name, null),
            description: dto.description ?? null,
            priceType: dto.priceType,
            categoryId: dto.categoryId ?? null,
            imageUrls: dto.imageUrls ?? [],
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
            isAvailable: dto.isAvailable ?? true,
          }),
        );
        await this.replaceVariants(manager, item.id, variants);
        await this.replaceOptionGroups(
          manager,
          item.id,
          dto.optionGroupIds ?? [],
        );
        await this.saveDetails(manager, item.id, dto);
        return item.id;
      }),
    );
    return this.findOneOrFail(businessId, id);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateItemDto,
  ): Promise<ItemView> {
    const item = await this.items.findOne({
      where: { id, businessId },
      relations: { variants: true },
    });
    if (!item) throw new NotFoundException(NOT_FOUND);
    assertDetailsMatchKind(item.kind, dto);
    if (dto.price !== undefined && dto.variants !== undefined) {
      throw new BadRequestException(
        'Envía el precio (price) o las presentaciones (variants), no ambos.',
      );
    }
    // `price` cambia la variante única, conservando su stock y SKU.
    let variants: VariantInputDto[] | undefined = dto.variants;
    if (dto.price !== undefined) {
      if (item.variants.length > 1) {
        throw new BadRequestException(
          'Este elemento tiene varias presentaciones: cambia el precio de cada una.',
        );
      }
      const [current] = item.variants;
      variants = [
        {
          id: current.id,
          name: current.name,
          price: dto.price,
          compareAtPrice:
            dto.compareAtPrice !== undefined
              ? dto.compareAtPrice
              : current.compareAtPrice,
          sku: current.sku,
          stock: current.stock,
          isAvailable: current.isAvailable,
        },
      ];
    }
    if (variants) assertVariants(variants);
    await this.assertReferences(businessId, dto, id);

    const previousImages = item.imageUrls;
    const previousName = item.name;
    for (const key of SIMPLE_FIELDS) {
      if (dto[key] !== undefined) {
        (item as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }
    await this.dataSource.transaction(async (manager) => {
      // Otro nombre, otro enlace (si el nuevo da el mismo slug, se conserva).
      if (
        dto.name !== undefined &&
        slugifyName(dto.name) !== slugifyName(previousName)
      ) {
        item.slug = await this.freeSlug(manager, businessId, dto.name, id);
      }
      const { variants: _loaded, ...fields } = item;
      await manager.save(Item, fields);
      if (variants) await this.replaceVariants(manager, id, variants);
      if (dto.optionGroupIds) {
        await this.replaceOptionGroups(manager, id, dto.optionGroupIds);
      }
      await this.saveDetails(manager, id, dto);
    });
    if (dto.imageUrls) {
      const kept = new Set(dto.imageUrls);
      await this.catalogImages.deleteUnused(
        businessId,
        previousImages.filter((url) => !kept.has(url)),
      );
    }
    return this.findOneOrFail(businessId, id);
  }

  /**
   * Ordena estos elementos como vienen (los de una categoría, por ejemplo).
   * Los demás no cambian. Todos deben ser del negocio.
   */
  async reorder(businessId: string, itemIds: string[]): Promise<void> {
    const count = await this.items.countBy({ businessId, id: In(itemIds) });
    if (count !== itemIds.length) {
      throw new BadRequestException(
        'Algún elemento no existe en este negocio.',
      );
    }
    await this.dataSource.query(
      `UPDATE "catalog_items" i
          SET "sort_order" = o.position - 1, "updated_at" = now()
         FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE i."id" = o.id AND i."business_id" = $1`,
      [businessId, itemIds],
    );
  }

  /** Disponible o agotado. Lo puede hacer cualquier miembro del personal. */
  async setAvailability(
    businessId: string,
    id: string,
    isAvailable: boolean,
  ): Promise<ItemView> {
    const result = await this.items.update({ id, businessId }, { isAvailable });
    if (!result.affected) throw new NotFoundException(NOT_FOUND);
    return this.findOneOrFail(businessId, id);
  }

  /**
   * "Borrar" es un borrado lógico: deja de verse y de poder pedirse, pero el
   * registro y sus fotos se conservan (pedidos, planes y una posible
   * recuperación lo necesitan).
   */
  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.items.softDelete({ id, businessId });
    if (!result.affected) throw new NotFoundException(NOT_FOUND);
  }

  /** Lo borrado, lo más reciente primero: se puede recuperar. */
  async listDeleted(businessId: string) {
    const items = await this.items.find({
      where: { businessId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      relations: { variants: true },
      order: { deletedAt: 'DESC' },
      take: 100,
    });
    return items.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      imageUrls: item.imageUrls,
      priceType: item.priceType,
      price: lowestPrice(item.variants),
      deletedAt: item.deletedAt,
    }));
  }

  /** Vuelve a la tienda con su enlace, fotos y opciones de antes. */
  async restore(businessId: string, id: string): Promise<ItemView> {
    const result = await this.items.restore({ id, businessId });
    if (!result.affected) throw new NotFoundException(NOT_FOUND);
    return this.findOneOrFail(businessId, id);
  }

  /**
   * Slug del nombre, libre en el negocio. Bloquea las filas del negocio con
   * ese prefijo para que dos altas a la vez no tomen el mismo.
   */
  private async freeSlug(
    manager: EntityManager,
    businessId: string,
    name: string,
    selfId: string | null,
  ): Promise<string> {
    const base = slugifyName(name);
    const rows: { slug: string }[] = await manager.query(
      `SELECT "slug" FROM "catalog_items"
        WHERE "business_id" = $1 AND ("slug" = $2 OR "slug" LIKE $3)
          AND ($4::uuid IS NULL OR "id" <> $4::uuid)
        FOR UPDATE`,
      [businessId, base, `${escapeLike(base)}-%`, selfId],
    );
    return firstFreeSlug(base, new Set(rows.map((r) => r.slug)));
  }

  private async assertKindEnabled(businessId: string, kind: ItemKind) {
    const features = await this.features.list(businessId);
    if (!enabledKinds(features).includes(kind)) {
      throw new BadRequestException(
        `Para crear ${KIND_LABEL[kind]}, activa ${KIND_FEATURES[kind].join(' o ')}.`,
      );
    }
  }

  /** Categoría, grupos de opciones y beneficios: todos del mismo negocio. */
  private async assertReferences(
    businessId: string,
    dto: Pick<CreateItemDto, 'categoryId' | 'optionGroupIds' | 'plan'>,
    selfId: string | null,
  ) {
    if (dto.categoryId) {
      const exists = await this.dataSource
        .getRepository(Category)
        .existsBy({ id: dto.categoryId, businessId });
      if (!exists) {
        throw new BadRequestException(
          'La categoría no existe en este negocio.',
        );
      }
    }
    if (dto.optionGroupIds) {
      await this.optionGroups.assertBelongToBusiness(
        businessId,
        dto.optionGroupIds,
      );
    }
    const included = [
      ...new Set(
        (dto.plan?.benefits ?? [])
          .map((b) => b.includedItemId)
          .filter((v): v is string => Boolean(v)),
      ),
    ];
    if (included.length) {
      const count = await this.items.countBy({
        businessId,
        id: In(included),
        kind: Not(ItemKind.Plan),
      });
      if (count !== included.length || (selfId && included.includes(selfId))) {
        throw new BadRequestException(
          'Un beneficio del plan apunta a un servicio o producto que no existe en este negocio.',
        );
      }
    }
  }

  /** Crea, actualiza y borra variantes para dejar exactamente `inputs`. */
  private async replaceVariants(
    manager: EntityManager,
    itemId: string,
    inputs: VariantInputDto[],
  ) {
    const existing = await manager.findBy(Variant, { itemId });
    const known = new Set(existing.map((v) => v.id));
    for (const input of inputs) {
      if (input.id && !known.has(input.id)) {
        throw new BadRequestException(
          'Una de las presentaciones no pertenece a este elemento.',
        );
      }
    }
    const kept = new Set(inputs.map((v) => v.id).filter(Boolean));
    const removed = existing.filter((v) => !kept.has(v.id)).map((v) => v.id);
    if (removed.length) await manager.delete(Variant, { id: In(removed) });
    // Con una sola variante el nombre sobra: el editor muestra "Precio".
    const single = inputs.length === 1;
    await manager.save(
      Variant,
      inputs.map((input, sortOrder) =>
        manager.create(Variant, {
          id: input.id,
          itemId,
          name: single ? input.name?.trim() || null : input.name!.trim(),
          price: input.price,
          compareAtPrice: input.compareAtPrice ?? null,
          sku: input.sku?.trim() || null,
          stock: input.stock ?? null,
          isAvailable: input.isAvailable ?? true,
          sortOrder,
        }),
      ),
    );
  }

  private async replaceOptionGroups(
    manager: EntityManager,
    itemId: string,
    groupIds: string[],
  ) {
    await manager.delete(ItemOptionGroup, { itemId });
    if (!groupIds.length) return;
    await manager.insert(
      ItemOptionGroup,
      groupIds.map((groupId, sortOrder) => ({ itemId, groupId, sortOrder })),
    );
  }

  private async saveDetails(
    manager: EntityManager,
    itemId: string,
    dto: Pick<CreateItemDto, 'service' | 'plan'>,
  ) {
    if (dto.service) {
      await manager.save(
        manager.create(ServiceDetails, {
          itemId,
          durationMinutes: dto.service.durationMinutes,
          bufferMinutes: dto.service.bufferMinutes ?? 0,
        }),
      );
    }
    if (dto.plan) await this.savePlan(manager, itemId, dto.plan);
  }

  private async savePlan(
    manager: EntityManager,
    itemId: string,
    plan: PlanDetailsDto,
  ) {
    await manager.save(
      manager.create(PlanDetails, {
        itemId,
        interval: plan.interval,
        intervalCount: plan.intervalCount ?? 1,
        trialDays: plan.trialDays ?? 0,
      }),
    );
    if (!plan.benefits) return;
    await manager.delete(PlanBenefit, { planItemId: itemId });
    if (!plan.benefits.length) return;
    await manager.insert(
      PlanBenefit,
      plan.benefits.map((b, sortOrder) => ({
        planItemId: itemId,
        label: b.label,
        includedItemId: b.includedItemId ?? null,
        quantity: b.quantity ?? null,
        sortOrder,
      })),
    );
  }
}

/**
 * Dos altas con el mismo nombre al mismo tiempo pueden elegir el mismo slug;
 * el índice único rechaza la segunda, que se reintenta con el siguiente libre.
 */
async function retryOnSlugConflict<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const constraint = (error as { driverError?: { constraint?: string } })
        .driverError?.constraint;
      if (constraint !== 'uq_catalog_items_business_slug' || attempt === 3) {
        throw error;
      }
    }
  }
}

/** El precio más bajo, para "Desde $…" y para ordenar. */
export function lowestPrice(variants: Pick<Variant, 'price'>[]): number {
  return variants.length ? Math.min(...variants.map((v) => v.price)) : 0;
}

/** Los detalles de servicio o plan solo valen para ese tipo. */
function assertDetailsMatchKind(
  kind: ItemKind,
  dto: Pick<CreateItemDto, 'service' | 'plan'>,
) {
  if (dto.service && kind !== ItemKind.Service) {
    throw new BadRequestException('La duración solo aplica a servicios.');
  }
  if (dto.plan && kind !== ItemKind.Plan) {
    throw new BadRequestException('El cobro periódico solo aplica a planes.');
  }
}

/**
 * Varias presentaciones necesitan nombres distintos, y el precio de antes
 * debe ser mayor que el actual.
 */
export function assertVariants(variants: VariantInputDto[]) {
  if (variants.length > 1) {
    const names = variants.map((v) => v.name?.trim().toLowerCase() ?? '');
    if (names.some((n) => !n)) {
      throw new BadRequestException(
        'Con varias presentaciones, cada una necesita un nombre (por ejemplo, Personal y Familiar).',
      );
    }
    if (new Set(names).size !== names.length) {
      throw new BadRequestException(
        'Hay dos presentaciones con el mismo nombre.',
      );
    }
  }
  for (const v of variants) {
    if (
      v.compareAtPrice !== undefined &&
      v.compareAtPrice !== null &&
      toCents(v.compareAtPrice) <= toCents(v.price)
    ) {
      throw new BadRequestException(
        'El precio de antes debe ser mayor que el precio actual.',
      );
    }
  }
}
