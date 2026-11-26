import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ItemKind, PriceType } from '../catalog/catalog.enums.js';
import { Item } from '../catalog/entities/item.entity.js';
import type { Option } from '../catalog/entities/option.entity.js';
import { PromotionsService } from '../catalog/promotions.service.js';
import { toCents } from '../common/money.js';
import type { OrderItemInputDto } from './dto/order.dto.js';
import type { OrderItemOption } from './entities/order-item.entity.js';

export interface PricedLine {
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string | null;
  /** La presentación lleva inventario: se descuenta al crear el pedido. */
  tracksStock: boolean;
  quantity: number;
  unitCents: number;
  lineCents: number;
  options: OrderItemOption[];
  notes: string | null;
  /** Promoción aplicada (happy hour), si había una activa. */
  promotionName: string | null;
}

/**
 * Valida los ítems contra el catálogo actual y calcula sus precios. Nunca se
 * confía en precios enviados por el cliente.
 */
@Injectable()
export class OrderPricingService {
  constructor(
    @InjectRepository(Item)
    private readonly items: Repository<Item>,
    @Optional() private readonly promotions?: PromotionsService,
  ) {}

  async price(
    businessId: string,
    items: OrderItemInputDto[],
  ): Promise<PricedLine[]> {
    const ids = [...new Set(items.map((i) => i.itemId))];
    const found = await this.items.find({
      where: { businessId, id: In(ids) },
      // Sin el JOIN que multiplica filas (ver PublicCatalogService).
      relationLoadStrategy: 'query',
      relations: {
        category: true,
        variants: true,
        optionGroupLinks: { group: { options: true } },
      },
    });
    const byId = new Map(found.map((p) => [p.id, p]));
    // Las promociones activas ahora (happy hour) bajan el precio de lo que cubren.
    const live = (await this.promotions?.live(businessId)) ?? [];
    return items.map((item, index) => {
      const line = this.priceLine(byId.get(item.itemId), item, index);
      const product = byId.get(item.itemId)!;
      const discount = PromotionsService.best(
        live,
        { id: product.id, categoryId: product.categoryId },
        line.unitCents,
      );
      if (!discount) return line;
      return {
        ...line,
        unitCents: discount.unitCents,
        lineCents: discount.unitCents * line.quantity,
        promotionName: `${discount.promotionName} −${discount.percent} %`,
      };
    });
  }

  private priceLine(
    product: Item | undefined,
    item: OrderItemInputDto,
    index: number,
  ): PricedLine {
    // Un elemento inactivo, o de una categoría inactiva, no está en el menú.
    // Los servicios se agendan y los planes se suscriben: no se piden.
    if (
      !product ||
      product.kind !== ItemKind.Product ||
      !product.isActive ||
      (product.category && !product.category.isActive)
    ) {
      throw new BadRequestException(
        `El producto del ítem ${index + 1} no está disponible en el menú.`,
      );
    }
    if (product.priceType === PriceType.OnRequest) {
      throw new BadRequestException(
        `"${product.name}" se cotiza: escríbele al negocio para pedirlo.`,
      );
    }
    if (!product.isAvailable) {
      throw new BadRequestException(`"${product.name}" está agotado.`);
    }
    // Sin variantId solo vale si hay una sola presentación.
    const variant = item.variantId
      ? product.variants.find((v) => v.id === item.variantId)
      : product.variants.length === 1
        ? product.variants[0]
        : undefined;
    if (!variant) {
      throw new BadRequestException(
        item.variantId
          ? `La presentación elegida no corresponde a "${product.name}".`
          : `Elige la presentación de "${product.name}".`,
      );
    }
    const label = variant.name
      ? `${product.name} (${variant.name})`
      : product.name;
    if (!variant.isAvailable || variant.stock === 0) {
      throw new BadRequestException(`"${label}" está agotado.`);
    }
    if (variant.stock !== null && item.quantity > variant.stock) {
      throw new BadRequestException(
        `Solo quedan ${variant.stock} unidades de "${label}".`,
      );
    }

    // Opciones válidas para este producto, por id.
    const links = [...product.optionGroupLinks].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const allowed = new Map<string, { groupId: string; option: Option }>();
    for (const link of links) {
      for (const option of link.group.options) {
        allowed.set(option.id, { groupId: link.groupId, option });
      }
    }

    const chosenByGroup = new Map<
      string,
      { option: Option; quantity: number }[]
    >();
    for (const input of item.options ?? []) {
      const found = allowed.get(input.optionId);
      if (!found) {
        throw new BadRequestException(
          `Una de las opciones elegidas no corresponde a "${product.name}".`,
        );
      }
      if (!found.option.isAvailable) {
        throw new BadRequestException(
          `La opción "${found.option.name}" de "${product.name}" no está disponible.`,
        );
      }
      const quantity = input.quantity ?? 1;
      if (quantity > found.option.maxQuantity) {
        throw new BadRequestException(
          `"${found.option.name}" se puede elegir máximo ${found.option.maxQuantity} ${found.option.maxQuantity === 1 ? 'vez' : 'veces'}.`,
        );
      }
      const list = chosenByGroup.get(found.groupId) ?? [];
      list.push({ option: found.option, quantity });
      chosenByGroup.set(found.groupId, list);
    }
    let unitCents =
      product.priceType === PriceType.Free ? 0 : toCents(variant.price);
    const options: OrderItemOption[] = [];
    for (const { group } of links) {
      const chosen = (chosenByGroup.get(group.id) ?? []).sort(
        (a, b) => a.option.sortOrder - b.option.sortOrder,
      );
      // Los límites del grupo cuentan las repeticiones: 2 × Queso son 2.
      const count = chosen.reduce((sum, c) => sum + c.quantity, 0);
      if (count < group.minSelect || count > group.maxSelect) {
        const rule =
          group.minSelect === group.maxSelect
            ? `${group.minSelect}`
            : group.minSelect === 0
              ? `máximo ${group.maxSelect}`
              : `entre ${group.minSelect} y ${group.maxSelect}`;
        throw new BadRequestException(
          `"${product.name}": en "${group.name}" debes elegir ${rule}.`,
        );
      }
      for (const { option, quantity } of chosen) {
        unitCents += toCents(option.priceDelta) * quantity;
        options.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
          quantity,
        });
      }
    }
    return {
      itemId: product.id,
      itemName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      tracksStock: variant.stock !== null,
      quantity: item.quantity,
      unitCents,
      lineCents: unitCents * item.quantity,
      options,
      notes: item.notes || null,
      promotionName: null,
    };
  }
}
