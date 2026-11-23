import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, Not, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import type { CustomerJwtPayload } from './customer-jwt.js';
import type {
  CustomerLoginDto,
  CustomerRegisterDto,
  UpdateMyCustomerDto,
} from './dto/customer-auth.dto.js';
import { Customer } from './entities/customer.entity.js';

export interface CustomerAuthResponse {
  accessToken: string;
  customer: Customer;
}

/** Registro, login y perfil propio de los clientes finales, por negocio. */
/** "Sesión infinita" del teléfono: 10 años. */
const DEVICE_SESSION_SECONDS = 10 * 365 * 24 * 60 * 60;

@Injectable()
export class CustomerAuthService {
  private readonly dummyHash = argon2.hash('timing-equalizer');
  private readonly expiresIn: number;

  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    // Segundos. Por defecto 30 días.
    this.expiresIn = Number(config.get('CUSTOMER_JWT_EXPIRES_IN', '2592000'));
  }

  async register(
    businessId: string,
    dto: CustomerRegisterDto,
  ): Promise<CustomerAuthResponse> {
    const passwordHash = await argon2.hash(dto.password);
    let saved: Customer;
    try {
      saved = await this.customers.save(
        this.customers.create({
          businessId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash,
          registeredAt: new Date(),
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('El email ya está registrado.');
      }
      throw error;
    }
    return this.issueToken(await this.findOrFail(businessId, saved.id));
  }

  async login(
    businessId: string,
    dto: CustomerLoginDto,
  ): Promise<CustomerAuthResponse> {
    const customer = await this.customers.findOne({
      where: { businessId, email: dto.email, passwordHash: Not(IsNull()) },
      select: { id: true, passwordHash: true },
    });
    const hash = customer?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(hash, dto.password);
    if (!customer || !valid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    return this.issueToken(await this.findOrFail(businessId, customer.id));
  }

  /** Verifica el token y que pertenezca a este negocio. */
  async authenticate(token: string, businessId: string): Promise<Customer> {
    let payload: CustomerJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<CustomerJwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'customer' || payload.bid !== businessId) {
      throw new UnauthorizedException();
    }
    const customer = await this.customers.findOneBy({
      id: payload.sub,
      businessId,
    });
    // Con cuenta o invitado con sesión en su teléfono (la que se abre al pedir).
    if (!customer) throw new UnauthorizedException();
    return customer;
  }

  /**
   * Sesión del teléfono con el que el cliente hizo su pedido: sin vencimiento
   * práctico (10 años), para que sus próximos pedidos sean suyos sin pedirle
   * nada. Solo sirve en este negocio.
   */
  async issueDeviceToken(customer: Customer): Promise<string> {
    const payload: CustomerJwtPayload = {
      sub: customer.id,
      typ: 'customer',
      bid: customer.businessId,
    };
    return this.jwt.signAsync(payload, { expiresIn: DEVICE_SESSION_SECONDS });
  }

  /** Datos del último pedido: nombre, teléfono y dirección para el próximo. */
  async rememberFromOrder(
    businessId: string,
    customerId: string,
    data: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
      addressReference?: string | null;
    },
  ): Promise<void> {
    const patch: Partial<Customer> = {};
    if (data.name) patch.name = data.name;
    if (data.phone) patch.phone = data.phone;
    if (data.address) {
      patch.address = data.address;
      patch.addressReference = data.addressReference ?? null;
    }
    if (Object.keys(patch).length) {
      await this.customers.update({ id: customerId, businessId }, patch);
    }
  }

  async updateMe(
    customer: Customer,
    dto: UpdateMyCustomerDto,
  ): Promise<Customer> {
    if (dto.name !== undefined) customer.name = dto.name;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.address !== undefined) customer.address = dto.address;
    if (dto.addressReference !== undefined) {
      customer.addressReference = dto.addressReference;
    }
    await this.customers.save(customer);
    return this.findOrFail(customer.businessId, customer.id);
  }

  private async findOrFail(businessId: string, id: string) {
    const customer = await this.customers.findOneBy({ id, businessId });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    return customer;
  }

  private async issueToken(customer: Customer): Promise<CustomerAuthResponse> {
    const payload: CustomerJwtPayload = {
      sub: customer.id,
      typ: 'customer',
      bid: customer.businessId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.expiresIn,
    });
    return { accessToken, customer };
  }
}
