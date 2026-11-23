import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import type { CreateTableDto, UpdateTableDto } from './dto/menu.dto.js';
import { MenuTable } from './entities/menu-table.entity.js';

const NOT_FOUND = 'Mesa no encontrada.';
const NAME_TAKEN = 'Ya existe una mesa con ese nombre.';

const newQrToken = () => randomBytes(16).toString('base64url');

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(MenuTable)
    private readonly tables: Repository<MenuTable>,
  ) {}

  list(businessId: string): Promise<MenuTable[]> {
    return this.tables.find({
      where: { businessId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOneOrFail(businessId: string, id: string): Promise<MenuTable> {
    const table = await this.tables.findOneBy({ id, businessId });
    if (!table) throw new NotFoundException(NOT_FOUND);
    return table;
  }

  /** Mesa activa por su código QR, para los pedidos desde la mesa. */
  async findActiveByQrToken(
    businessId: string,
    qrToken: string,
  ): Promise<MenuTable> {
    const table = await this.tables.findOneBy({
      businessId,
      qrToken,
      isActive: true,
    });
    if (!table) throw new NotFoundException(NOT_FOUND);
    return table;
  }

  async create(businessId: string, dto: CreateTableDto): Promise<MenuTable> {
    return this.save(
      this.tables.create({
        businessId,
        name: dto.name,
        zone: dto.zone ?? null,
        capacity: dto.capacity ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        qrToken: newQrToken(),
      }),
    );
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateTableDto,
  ): Promise<MenuTable> {
    const table = await this.findOneOrFail(businessId, id);
    for (const key of [
      'name',
      'zone',
      'capacity',
      'isActive',
      'sortOrder',
    ] as const) {
      if (dto[key] !== undefined) {
        (table as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }
    return this.save(table);
  }

  /** Genera un QR nuevo. Los QR impresos de esta mesa dejan de funcionar. */
  async regenerateQr(businessId: string, id: string): Promise<MenuTable> {
    const table = await this.findOneOrFail(businessId, id);
    table.qrToken = newQrToken();
    return this.save(table);
  }

  /** Los pedidos de la mesa se conservan, con el nombre de la mesa guardado. */
  async remove(businessId: string, id: string): Promise<void> {
    const result = await this.tables.delete({ id, businessId });
    if (!result.affected) throw new NotFoundException(NOT_FOUND);
  }

  private async save(table: MenuTable): Promise<MenuTable> {
    try {
      return await this.tables.save(table);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(NAME_TAKEN);
      throw error;
    }
  }
}
