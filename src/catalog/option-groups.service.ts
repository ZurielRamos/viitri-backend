import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, type EntityManager } from 'typeorm';
import type {
  CreateOptionGroupDto,
  OptionInputDto,
  UpdateOptionGroupDto,
} from './dto/catalog.dto.js';
import { OptionGroup } from './entities/option-group.entity.js';
import { Option } from './entities/option.entity.js';

const NOT_FOUND = 'Grupo de opciones no encontrado.';

@Injectable()
export class OptionGroupsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OptionGroup)
    private readonly groups: Repository<OptionGroup>,
  ) {}

  list(businessId: string): Promise<OptionGroup[]> {
    return this.groups.find({
      where: { businessId },
      relations: { options: true },
      order: { name: 'ASC', options: { sortOrder: 'ASC' } },
    });
  }

  async findOneOrFail(businessId: string, id: string): Promise<OptionGroup> {
    const group = await this.groups.findOne({
      where: { id, businessId },
      relations: { options: true },
      order: { options: { sortOrder: 'ASC' } },
    });
    if (!group) throw new NotFoundException(NOT_FOUND);
    return group;
  }

  async create(
    businessId: string,
    dto: CreateOptionGroupDto,
  ): Promise<OptionGroup> {
    const minSelect = dto.minSelect ?? 0;
    const maxSelect = dto.maxSelect ?? 1;
    this.assertRange(
      minSelect,
      maxSelect,
      dto.options.map((o) => o.maxQuantity ?? 1),
    );
    if (dto.options.some((o) => o.id)) {
      throw new BadRequestException(
        'Las opciones de un grupo nuevo no llevan id.',
      );
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const group = await manager.save(
        manager.create(OptionGroup, {
          businessId,
          name: dto.name,
          minSelect,
          maxSelect,
        }),
      );
      await this.syncOptions(manager, group.id, dto.options);
      return group.id;
    });
    return this.findOneOrFail(businessId, id);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateOptionGroupDto,
  ): Promise<OptionGroup> {
    const group = await this.findOneOrFail(businessId, id);
    const minSelect = dto.minSelect ?? group.minSelect;
    const maxSelect = dto.maxSelect ?? group.maxSelect;
    this.assertRange(
      minSelect,
      maxSelect,
      dto.options
        ? dto.options.map(
            (o) =>
              o.maxQuantity ??
              group.options.find((g) => g.id === o.id)?.maxQuantity ??
              1,
          )
        : group.options.map((o) => o.maxQuantity),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        OptionGroup,
        { id },
        {
          name: dto.name ?? group.name,
          minSelect,
          maxSelect,
          updatedAt: new Date(),
        },
      );
      if (dto.options) await this.syncOptions(manager, id, dto.options);
    });
    return this.findOneOrFail(businessId, id);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.groups.delete({ id, businessId });
    if (!result.affected) throw new NotFoundException(NOT_FOUND);
  }

  /** Confirma que todos los grupos existan y sean de este negocio. */
  async assertBelongToBusiness(businessId: string, ids: string[]) {
    if (!ids.length) return;
    const found = await this.groups.countBy({ businessId, id: In(ids) });
    if (found !== ids.length) {
      throw new BadRequestException(
        'Algún grupo de opciones no existe en este negocio.',
      );
    }
  }

  /**
   * El mínimo debe poder cumplirse con las opciones que hay (contando las
   * que se pueden repetir) y ninguna opción puede repetirse más que el
   * máximo del grupo.
   */
  private assertRange(min: number, max: number, maxQuantities: number[]) {
    if (min > max) {
      throw new BadRequestException(
        'El mínimo no puede ser mayor que el máximo.',
      );
    }
    const reachable = maxQuantities.reduce((sum, q) => sum + q, 0);
    if (min > reachable) {
      throw new BadRequestException(
        'Con estas opciones no se alcanza el mínimo que pides elegir.',
      );
    }
    if (maxQuantities.some((q) => q > max)) {
      throw new BadRequestException(
        'Una opción no puede repetirse más veces que el máximo del grupo.',
      );
    }
  }

  /**
   * Deja el grupo con exactamente estas opciones, en este orden. Las que traen
   * `id` se actualizan (deben ser del grupo), las nuevas se crean y las que no
   * vienen se borran.
   */
  private async syncOptions(
    manager: EntityManager,
    groupId: string,
    inputs: OptionInputDto[],
  ) {
    const existing = await manager.findBy(Option, { groupId });
    const existingIds = new Set(existing.map((o) => o.id));
    const keptIds = new Set<string>();

    for (const input of inputs) {
      if (input.id && !existingIds.has(input.id)) {
        throw new BadRequestException(
          `La opción ${input.id} no pertenece a este grupo.`,
        );
      }
      if (input.id && keptIds.has(input.id)) {
        throw new BadRequestException(`La opción ${input.id} está repetida.`);
      }
      if (input.id) keptIds.add(input.id);
    }

    const toDelete = existing.filter((o) => !keptIds.has(o.id));
    if (toDelete.length) await manager.remove(toDelete);

    const byId = new Map(existing.map((o) => [o.id, o]));
    await manager.save(
      inputs.map((input, index) => {
        const option =
          (input.id && byId.get(input.id)) ||
          manager.create(Option, { groupId });
        option.name = input.name;
        if (input.priceDelta !== undefined)
          option.priceDelta = input.priceDelta;
        else if (!input.id) option.priceDelta = 0;
        if (input.isAvailable !== undefined)
          option.isAvailable = input.isAvailable;
        if (input.maxQuantity !== undefined)
          option.maxQuantity = input.maxQuantity;
        else if (!input.id) option.maxQuantity = 1;
        option.sortOrder = index;
        return option;
      }),
    );
  }
}
