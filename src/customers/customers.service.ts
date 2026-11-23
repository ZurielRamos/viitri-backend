import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { escapeLike } from '../common/sql.js';
import type {
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/manage-customer.dto.js';
import { Customer } from './entities/customer.entity.js';

const NOT_FOUND = 'Cliente no encontrado.';

/** Gestión de clientes por parte del personal del negocio. */
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  async list(businessId: string, query: ListCustomersQueryDto) {
    const qb = this.customers
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .orderBy('c.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.q) {
      const term = `%${escapeLike(query.q)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('c.name ILIKE :term', { term })
            .orWhere('c.email ILIKE :term', { term })
            .orWhere('c.phone ILIKE :term', { term }),
        ),
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Incluye las notas internas: solo para el personal. */
  async findOneOrFail(businessId: string, id: string): Promise<Customer> {
    const customer = await this.customers
      .createQueryBuilder('c')
      .addSelect('c.notes')
      .where('c.id = :id AND c.businessId = :businessId', { id, businessId })
      .getOne();
    if (!customer) throw new NotFoundException(NOT_FOUND);
    return customer;
  }

  /** Crea un cliente invitado. */
  async create(businessId: string, dto: CreateCustomerDto): Promise<Customer> {
    const saved = await this.customers.save(
      this.customers.create({
        businessId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        notes: dto.notes ?? null,
      }),
    );
    return this.findOneOrFail(businessId, saved.id);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOneOrFail(businessId, id);

    if (dto.email !== undefined && dto.email !== customer.email) {
      if (customer.registeredAt) {
        throw new BadRequestException(
          'El email de un cliente con cuenta no se puede cambiar desde el panel.',
        );
      }
      customer.email = dto.email;
    }
    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.notes !== undefined) customer.notes = dto.notes;

    try {
      await this.customers.save(customer);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una cuenta con ese email.');
      }
      throw error;
    }
    return this.findOneOrFail(businessId, id);
  }
}
