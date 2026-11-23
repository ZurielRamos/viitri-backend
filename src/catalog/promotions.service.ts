import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import type { PromotionInputDto } from './dto/promotion.dto.js';
import { Category } from './entities/category.entity.js';
import { Item } from './entities/item.entity.js';
import { Promotion } from './entities/promotion.entity.js';
import {
  discountCents,
  isPromotionLive,
  promotionCovers,
} from './promotion-schedule.js';

/** Promoción con "activa ahora" según la hora del negocio. */
export type PromotionView = Promotion & { liveNow: boolean };

/** Precio de un producto con la mejor promoción activa ahora. */
export interface Discount {
  promotionName: string;
  percent: number;
  unitCents: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Promotion)
    private readonly promotions: Repository<Promotion>,
  ) {}

  async list(businessId: string): Promise<PromotionView[]> {
    const [rows, tz] = await Promise.all([
      this.promotions.find({
        where: { businessId },
        order: { createdAt: 'ASC' },
      }),
      this.timezone(businessId),
    ]);
    const now = new Date();
    return rows.map((p) =>
      Object.assign(p, { liveNow: isPromotionLive(p, now, tz) }),
    );
  }

  async create(businessId: string, dto: PromotionInputDto): Promise<Promotion> {
    await this.assertTargets(businessId, dto);
    return this.promotions.save(
      this.promotions.create({
        businessId,
        ...fields(dto),
        categoryIds: dto.categoryIds ?? [],
        itemIds: dto.itemIds ?? [],
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(
    businessId: string,
    id: string,
    dto: PromotionInputDto,
  ): Promise<Promotion> {
    const promotion = await this.promotions.findOne({
      where: { id, businessId },
    });
    if (!promotion) throw new NotFoundException('Promoción no encontrada.');
    await this.assertTargets(businessId, dto);
    Object.assign(promotion, {
      ...fields(dto),
      categoryIds: dto.categoryIds ?? [],
      itemIds: dto.itemIds ?? [],
      isActive: dto.isActive ?? promotion.isActive,
    });
    return this.promotions.save(promotion);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const { affected } = await this.promotions.delete({ id, businessId });
    if (!affected) throw new NotFoundException('Promoción no encontrada.');
  }

  /** Las activas en este momento, para calcular precios. */
  async live(businessId: string): Promise<Promotion[]> {
    return (await this.list(businessId)).filter((p) => p.liveNow);
  }

  /** La mejor promoción activa para el producto; `null` si ninguna aplica. */
  static best(
    live: Promotion[],
    item: { id: string; categoryId: string | null },
    unitCents: number,
  ): Discount | null {
    const promo = live
      .filter((p) => promotionCovers(p, item))
      .sort((a, b) => b.percent - a.percent)[0];
    if (!promo || unitCents <= 0) return null;
    return {
      promotionName: promo.name,
      percent: promo.percent,
      unitCents: discountCents(unitCents, promo.percent),
    };
  }

  private async timezone(businessId: string): Promise<string> {
    const [row] = (await this.dataSource.query(
      `SELECT "timezone" FROM "business_profiles" WHERE "business_id" = $1`,
      [businessId],
    )) as { timezone: string }[];
    return row?.timezone || 'UTC';
  }

  private async assertTargets(businessId: string, dto: PromotionInputDto) {
    if (dto.startTime === dto.endTime) {
      throw new BadRequestException(
        'La hora de inicio y la de fin no pueden ser iguales.',
      );
    }
    const items = dto.itemIds ?? [];
    const categories = dto.categoryIds ?? [];
    const [itemCount, categoryCount] = await Promise.all([
      items.length
        ? this.dataSource
            .getRepository(Item)
            .count({ where: { businessId, id: In(items) } })
        : 0,
      categories.length
        ? this.dataSource
            .getRepository(Category)
            .count({ where: { businessId, id: In(categories) } })
        : 0,
    ]);
    if (itemCount !== items.length || categoryCount !== categories.length) {
      throw new BadRequestException(
        'Uno de los productos o categorías no existe.',
      );
    }
  }
}

/** Los campos de la promoción que se copian tal cual. */
function fields(dto: PromotionInputDto) {
  return {
    name: dto.name,
    percent: dto.percent,
    days: dto.days,
    startTime: dto.startTime,
    endTime: dto.endTime,
  };
}
