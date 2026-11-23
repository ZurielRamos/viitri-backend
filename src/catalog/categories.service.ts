import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/catalog.dto.js';
import { CatalogImagesService } from './catalog-images.service.js';
import { Category } from './entities/category.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    private readonly images: CatalogImagesService,
  ) {}

  list(businessId: string): Promise<Category[]> {
    return this.categories.find({
      where: { businessId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOneOrFail(businessId: string, id: string): Promise<Category> {
    const category = await this.categories.findOneBy({ id, businessId });
    if (!category) throw new NotFoundException('Categoría no encontrada.');
    return category;
  }

  create(businessId: string, dto: CreateCategoryDto): Promise<Category> {
    return this.categories.save(
      this.categories.create({
        businessId,
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        icon: dto.icon ?? null,
        displayMode: dto.displayMode,
        showInBar: dto.showInBar,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOneOrFail(businessId, id);
    const previousImage = category.imageUrl;
    for (const key of [
      'name',
      'description',
      'imageUrl',
      'icon',
      'displayMode',
      'showInBar',
      'sortOrder',
      'isActive',
    ] as const) {
      if (dto[key] !== undefined) {
        (category as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }
    const saved = await this.categories.save(category);
    if (previousImage && previousImage !== saved.imageUrl) {
      await this.images.deleteUnused(businessId, [previousImage]);
    }
    return saved;
  }

  /** Los elementos de la categoría quedan sin categoría. */
  async remove(businessId: string, id: string): Promise<void> {
    const category = await this.findOneOrFail(businessId, id);
    await this.categories.delete({ id, businessId });
    if (category.imageUrl) {
      await this.images.deleteUnused(businessId, [category.imageUrl]);
    }
  }
}
