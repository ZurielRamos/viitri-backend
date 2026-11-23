import {
  BadRequestException,
  ForbiddenException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { openStatus } from '../businesses/profile/open-status.js';
import { PaginationQueryDto } from '../common/pagination.dto.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { CurrentCustomer } from '../customers/decorators/current-customer.decorator.js';
import type { Customer } from '../customers/entities/customer.entity.js';
import { CustomerAuthGuard } from '../customers/guards/customer-auth.guard.js';
import { MenuSettingsService } from '../menu/menu-settings.service.js';
import { TablesService } from '../menu/tables.service.js';
import { fromCents } from '../common/money.js';
import { PlaceOrderDto, PriceCartDto } from './dto/order.dto.js';
import { OrderPricingService } from './order-pricing.service.js';
import type { Order } from './entities/order.entity.js';
import { OrderSource } from './order.enums.js';
import { OrdersService, type OrderDraft } from './orders.service.js';
import { canTakeOrders } from '../businesses/plans/plans.js';

/**
 * Pedidos desde la página pública del negocio. Se puede pedir como invitado
 * o con sesión de cliente (`Authorization: Bearer <token de cliente>`).
 */
@Public()
@Controller('public/businesses/:slug')
export class PublicOrdersController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly settings: MenuSettingsService,
    private readonly tables: TablesService,
    private readonly orders: OrdersService,
    private readonly customerAuth: CustomerAuthService,
    private readonly pricing: OrderPricingService,
  ) {}

  /**
   * Revisa el carrito antes del checkout: precio actual de cada producto, o
   * por qué ya no se puede pedir (agotado, sin una opción obligatoria…).
   * Revisa cada uno por separado para que un producto no tape a los demás.
   */
  @HttpCode(200)
  @Post('cart/price')
  async priceCart(@Param('slug') slug: string, @Body() dto: PriceCartDto) {
    const business = await this.findOrderingBusiness(slug);
    const settings = await this.settings.get(business.id);
    const lines = await Promise.all(
      dto.items.map(async (item) => {
        try {
          const [line] = await this.pricing.price(business.id, [item]);
          return {
            ok: true as const,
            unitPrice: fromCents(line.unitCents),
            lineTotal: fromCents(line.lineCents),
          };
        } catch (error) {
          if (error instanceof BadRequestException) {
            return { ok: false as const, error: error.message };
          }
          throw error;
        }
      }),
    );
    const subtotal = lines.reduce(
      (sum, l) => (l.ok ? sum + l.lineTotal : sum),
      0,
    );
    return {
      currency: business.profile.currency,
      isAcceptingOrders: settings.isAcceptingOrders,
      lines,
      subtotal,
    };
  }

  /** Calcula precios, envío y total. Sirve para mostrar el carrito. */
  @HttpCode(200)
  @Post('orders/quote')
  async quote(@Param('slug') slug: string, @Body() dto: PlaceOrderDto) {
    const { business, settings, draft } = await this.prepare(slug, dto);
    return this.orders.presentQuote(
      await this.orders.quote(business, settings, draft),
    );
  }

  /**
   * Crea el pedido. La respuesta incluye `trackingToken`, que es lo único
   * que permite seguir el pedido sin sesión: no se puede recuperar después.
   */
  @Post('orders')
  async place(
    @Param('slug') slug: string,
    @Body() dto: PlaceOrderDto,
    @Req() request: Request,
  ) {
    const { business, settings, draft } = await this.prepare(slug, dto);
    const customer = await this.optionalCustomer(request, business.id);
    const { order, trackingToken } = await this.orders.create({
      business,
      settings,
      draft,
      source: OrderSource.Customer,
      contact: {
        customer,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        alwaysNewGuest: !customer,
      },
      notes: dto.notes,
    });
    // El pedido es del cliente; sus datos quedan para el próximo. Sin sesión,
    // se abre una en este teléfono (el cliente nuevo que se creó).
    let customerToken: string | undefined;
    if (order.customerId) {
      await this.customerAuth.rememberFromOrder(business.id, order.customerId, {
        name: dto.contactName,
        phone: dto.contactPhone,
        address: dto.delivery?.address,
        addressReference: dto.delivery?.reference,
      });
      if (!customer) {
        customerToken = await this.customerAuth.issueDeviceToken({
          id: order.customerId,
          businessId: business.id,
        } as Customer);
      }
    }
    return { order: this.toPublic(order), trackingToken, customerToken };
  }

  @Get('orders/track/:token')
  async track(@Param('slug') slug: string, @Param('token') token: string) {
    const business = await this.findMenuBusiness(slug);
    return this.toPublic(
      await this.orders.findByTrackingToken(business.id, token),
    );
  }

  /** Solo mientras el pedido está en `pending`. */
  @HttpCode(200)
  @Post('orders/track/:token/cancel')
  async cancel(@Param('slug') slug: string, @Param('token') token: string) {
    const business = await this.findMenuBusiness(slug);
    return this.toPublic(
      await this.orders.cancelByCustomer(business.id, token),
    );
  }

  /** Un pedido del cliente con sesión. */
  @UseGuards(CustomerAuthGuard)
  @Get('customers/me/orders/:orderId')
  async myOrder(
    @CurrentCustomer() customer: Customer,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.toPublic(
      await this.orders.findForCustomer(
        customer.businessId,
        customer.id,
        orderId,
      ),
    );
  }

  /** Historial de pedidos del cliente con sesión. */
  @UseGuards(CustomerAuthGuard)
  @Get('customers/me/orders')
  async myOrders(
    @CurrentCustomer() customer: Customer,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.orders.listForCustomer(
      customer.businessId,
      customer.id,
      { skip: query.skip, limit: query.limit, page: query.page },
    );
    return { ...result, items: result.items.map((o) => this.toPublic(o)) };
  }

  private async prepare(slug: string, dto: PlaceOrderDto) {
    const business = await this.findOrderingBusiness(slug);
    const settings = await this.settings.get(business.id);
    if (!settings.isAcceptingOrders) {
      throw new ConflictException(
        'El negocio no está recibiendo pedidos en este momento.',
      );
    }
    // Fuera del horario no se reciben pedidos (sin horario configurado, sí).
    if (!openStatus(business.profile).isOpen) {
      throw new ConflictException(
        'El negocio está cerrado en este momento. Vuelve en su horario de atención.',
      );
    }
    const table = dto.tableToken
      ? await this.tables.findActiveByQrToken(business.id, dto.tableToken)
      : null;
    const draft: OrderDraft = {
      type: dto.type,
      items: dto.items,
      table,
      tableLabel: table ? undefined : dto.tableLabel,
      delivery: dto.delivery,
      paymentMethod: dto.paymentMethod,
      cashChangeFor: dto.cashChangeFor,
    };
    return { business, settings, draft };
  }

  /** Para pedir: el plan vigente debe incluir los pedidos (desde Avanzado). */
  private async findOrderingBusiness(slug: string) {
    const business = await this.findMenuBusiness(slug);
    if (!canTakeOrders(business)) {
      throw new ForbiddenException('Este negocio no recibe pedidos en línea.');
    }
    return business;
  }

  private async findMenuBusiness(slug: string) {
    const business = await this.businesses.findBySlugOrFail(slug);
    if (!business.features.includes(BusinessFeature.Menu)) {
      throw new NotFoundException('Este negocio no tiene menú.');
    }
    return business;
  }

  /** Si llega un token, debe ser de un cliente válido de este negocio. */
  private async optionalCustomer(
    request: Request,
    businessId: string,
  ): Promise<Customer | null> {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    return this.customerAuth.authenticate(token, businessId);
  }

  /** Sin datos internos del negocio. */
  private toPublic(order: Order) {
    const {
      businessId: _businessId,
      customerId: _customerId,
      tableId: _tableId,
      trackingTokenHash: _hash,
      source: _source,
      ...rest
    } = order;
    return {
      ...rest,
      items: order.items.map(
        ({
          orderId: _orderId,
          itemId: _itemId,
          variantId: _variantId,
          stockReserved: _stock,
          ...item
        }) => item,
      ),
    };
  }
}
