import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  DataSource,
  In,
  IsNull,
  Repository,
  type EntityManager,
} from 'typeorm';
import type { Business } from '../businesses/entities/business.entity.js';
import { fromCents, toCents } from '../common/money.js';
import { Variant } from '../catalog/entities/variant.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import {
  DISTANCE_PROVIDER,
  type DistanceProvider,
} from '../delivery/distance-provider.js';
import type { MenuSettings } from '../menu/entities/menu-settings.entity.js';
import type { MenuTable } from '../menu/entities/menu-table.entity.js';
import type {
  DeliveryInputDto,
  ListOrdersQueryDto,
  OrderItemInputDto,
  UpdateOrderStatusDto,
} from './dto/order.dto.js';
import { OrderItem } from './entities/order-item.entity.js';
import { openTabFor } from './tabs.service.js';
import { Order } from './entities/order.entity.js';
import {
  OrderPricingService,
  type PricedLine,
} from './order-pricing.service.js';
import {
  ORDER_TRANSITIONS,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from './order.enums.js';
import { OrderNotificationsService } from './order-notifications.service.js';

/** Lo que define el precio de un pedido. */
export interface OrderDraft {
  type: OrderType;
  items: OrderItemInputDto[];
  table: MenuTable | null;
  /** En mesa sin QR: la mesa que escribe el cliente ("Mesa 4", "Terraza"). */
  tableLabel?: string;
  delivery?: DeliveryInputDto;
  paymentMethod?: PaymentMethod;
  cashChangeFor?: number;
}

export interface OrderQuote {
  currency: string;
  lines: PricedLine[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  distanceKm: number | null;
  /** Domicilio sin tarifas por distancia: el negocio confirma el envío. */
  deliveryFeeToConfirm: boolean;
  paymentMethod: PaymentMethod | null;
}

/** Quién hace el pedido y cómo contactarlo. */
export interface OrderContact {
  /** Cliente con cuenta que hace el pedido, o el elegido por el personal. */
  customer: Customer | null;
  contactName?: string;
  contactPhone?: string;
  /**
   * Pedido desde la tienda sin sesión: siempre un cliente nuevo (no se busca
   * por teléfono), porque ese teléfono recibe la sesión de ese cliente y no
   * debe abrir la de otra persona que escribió el mismo número.
   */
  alwaysNewGuest?: boolean;
  /**
   * Pedido que toma el personal: nunca abre sesión de cliente. Se atribuye a
   * un cliente existente con el mismo teléfono exacto o, si no hay teléfono,
   * con el mismo nombre exacto (si es uno solo); si no hay, se crea uno.
   */
  matchExisting?: boolean;
}

const NOT_FOUND = 'Pedido no encontrado.';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly pricing: OrderPricingService,
    @Inject(DISTANCE_PROVIDER) private readonly distance: DistanceProvider,
    private readonly notifications: OrderNotificationsService,
  ) {}

  // ---------- Cotización ----------

  /** Valida el pedido y calcula subtotal, envío y total sin guardar nada. */
  async quote(
    business: Business,
    settings: MenuSettings,
    draft: OrderDraft,
  ): Promise<OrderQuote> {
    this.assertTypeAllowed(settings, draft);

    const lines = await this.pricing.price(business.id, draft.items);
    const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);

    let deliveryFeeCents = 0;
    const distanceKm: number | null = null;
    let deliveryFeeToConfirm = false;
    if (draft.type === OrderType.Delivery && draft.delivery) {
      if (
        settings.deliveryMinOrder !== null &&
        subtotalCents < toCents(settings.deliveryMinOrder)
      ) {
        throw new BadRequestException(
          `El pedido mínimo para domicilio es ${settings.deliveryMinOrder}.`,
        );
      }
      // Valor fijo, por barrio o, si no, lo confirma el negocio con el cliente.
      if (
        settings.deliveryFeeMode === 'fixed' &&
        settings.deliveryFixedFee !== null
      ) {
        deliveryFeeCents = toCents(settings.deliveryFixedFee);
      } else if (settings.deliveryFeeMode === 'zones') {
        const wanted = draft.delivery.zone?.toLowerCase();
        const zone = settings.deliveryZones.find(
          (z) => z.name.toLowerCase() === wanted,
        );
        if (!zone) {
          throw new BadRequestException(
            'Elige tu barrio para calcular el domicilio.',
          );
        }
        deliveryFeeCents = toCents(zone.fee);
      } else {
        deliveryFeeToConfirm = true;
      }
    }

    const totalCents = subtotalCents + deliveryFeeCents;
    const paymentMethod = this.resolvePaymentMethod(draft, totalCents);

    return {
      currency: business.profile.currency,
      lines,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      distanceKm,
      deliveryFeeToConfirm,
      paymentMethod,
    };
  }

  /** Forma pública de una cotización. */
  presentQuote(quote: OrderQuote) {
    return {
      currency: quote.currency,
      items: quote.lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        variantId: l.variantId,
        variantName: l.variantName,
        quantity: l.quantity,
        unitPrice: fromCents(l.unitCents),
        lineTotal: fromCents(l.lineCents),
        options: l.options,
        notes: l.notes,
      })),
      subtotal: fromCents(quote.subtotalCents),
      deliveryFee: fromCents(quote.deliveryFeeCents),
      deliveryDistanceKm: quote.distanceKm,
      deliveryFeeToConfirm: quote.deliveryFeeToConfirm,
      total: fromCents(quote.totalCents),
    };
  }

  // ---------- Creación ----------

  /**
   * Crea el pedido. La distancia se calcula antes de abrir la transacción,
   * para no mantenerla abierta durante la llamada a Google.
   */
  async create(params: {
    business: Business;
    settings: MenuSettings;
    draft: OrderDraft;
    contact: OrderContact;
    source: OrderSource;
    notes?: string;
    /** Quién del equipo lo tomó, si se creó desde el panel. */
    takenBy?: string;
  }): Promise<{ order: Order; trackingToken: string }> {
    const { business, settings, draft, source } = params;
    const quote = await this.quote(business, settings, draft);
    const status =
      source === OrderSource.Customer && settings.requireOrderAcceptance
        ? OrderStatus.Pending
        : OrderStatus.Accepted;
    const trackingToken = randomBytes(24).toString('base64url');

    const orderId = await this.dataSource.transaction(async (manager) => {
      const contact = await this.resolveContact(
        manager,
        business.id,
        draft.type,
        params.contact,
      );
      const number = await this.nextOrderNumber(manager, business.id);
      // En mesa con mesa registrada (QR): el pedido suma a la cuenta abierta de la mesa.
      const tabId =
        draft.type === OrderType.DineIn && draft.table
          ? await openTabFor(manager, business.id, draft.table, quote.currency)
          : null;
      const now = new Date();

      const order = await manager.save(
        manager.create(Order, {
          businessId: business.id,
          number,
          type: draft.type,
          status,
          source,
          customerId: contact.customerId,
          tableId: draft.table?.id ?? null,
          tabId,
          tableName: draft.table?.name ?? draft.tableLabel ?? null,
          contactName: contact.name,
          contactPhone: contact.phone,
          deliveryAddress: draft.delivery?.address ?? null,
          deliveryReference: draft.delivery?.reference || null,
          deliveryZone: draft.delivery?.zone || null,
          deliveryLatitude: draft.delivery?.latitude ?? null,
          deliveryLongitude: draft.delivery?.longitude ?? null,
          deliveryDistanceKm: quote.distanceKm,
          currency: quote.currency,
          subtotal: fromCents(quote.subtotalCents),
          deliveryFee: fromCents(quote.deliveryFeeCents),
          total: fromCents(quote.totalCents),
          paymentMethod: quote.paymentMethod,
          cashChangeFor: draft.cashChangeFor ?? null,
          notes: params.notes || null,
          takenByName: params.takenBy ?? null,
          trackingTokenHash: hashToken(trackingToken),
          acceptedAt: status === OrderStatus.Accepted ? now : null,
        }),
      );

      await this.reserveStock(manager, quote.lines);
      await manager.insert(
        OrderItem,
        quote.lines.map((line, sortOrder) => ({
          orderId: order.id,
          itemId: line.itemId,
          itemName: line.itemName,
          variantId: line.variantId,
          variantName: line.variantName,
          stockReserved: line.tracksStock,
          unitPrice: fromCents(line.unitCents),
          quantity: line.quantity,
          lineTotal: fromCents(line.lineCents),
          options: line.options,
          notes: line.notes,
          promotionName: line.promotionName,
          sortOrder,
        })),
      );
      return order.id;
    });

    const order = await this.findOneOrFail(business.id, orderId);
    // Confirmación al cliente por WhatsApp, sin hacerlo esperar.
    void this.notifications.placed(business, order, trackingToken);
    return { order, trackingToken };
  }

  // ---------- Consultas ----------

  async findOneOrFail(businessId: string, id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id, businessId },
      relations: { items: true },
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!order) throw new NotFoundException(NOT_FOUND);
    return order;
  }

  async findByTrackingToken(businessId: string, token: string) {
    const order = await this.orders.findOne({
      where: { businessId, trackingTokenHash: hashToken(token) },
      relations: { items: true },
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!order) throw new NotFoundException(NOT_FOUND);
    return order;
  }

  async list(businessId: string, query: ListOrdersQueryDto) {
    const [items, total] = await this.orders.findAndCount({
      where: {
        businessId,
        ...(query.status?.length ? { status: In(query.status) } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      relations: { items: true },
      order: { createdAt: 'DESC', items: { sortOrder: 'ASC' } },
      skip: query.skip,
      take: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  /** Un pedido del cliente con sesión (Mis pedidos). */
  async findForCustomer(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id, businessId, customerId },
      relations: { items: true },
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!order) throw new NotFoundException(NOT_FOUND);
    return order;
  }

  async listForCustomer(
    businessId: string,
    customerId: string,
    page: { skip: number; limit: number; page: number },
  ) {
    const [items, total] = await this.orders.findAndCount({
      where: { businessId, customerId },
      relations: { items: true },
      order: { createdAt: 'DESC', items: { sortOrder: 'ASC' } },
      skip: page.skip,
      take: page.limit,
    });
    return { items, total, page: page.page, limit: page.limit };
  }

  // ---------- Estados y pago ----------

  async updateStatus(
    businessId: string,
    id: string,
    dto: UpdateOrderStatusDto,
    by?: string,
  ): Promise<Order> {
    const order = await this.findOneOrFail(businessId, id);
    const target = dto.status;

    if (!ORDER_TRANSITIONS[order.status].includes(target)) {
      throw new BadRequestException(
        `No se puede pasar un pedido de "${order.status}" a "${target}".`,
      );
    }
    if (
      target === OrderStatus.OutForDelivery &&
      order.type !== OrderType.Delivery
    ) {
      throw new BadRequestException('Solo los domicilios salen a entrega.');
    }
    if (
      target === OrderStatus.Completed &&
      order.type === OrderType.Delivery &&
      order.status !== OrderStatus.OutForDelivery
    ) {
      throw new BadRequestException(
        'Un domicilio se completa después de salir a entrega.',
      );
    }

    await this.transition(order, target, dto.reason);
    if (by) await this.orders.update({ id, businessId }, { handledByName: by });
    const updated = await this.findOneOrFail(businessId, id);
    void this.notifications.statusChanged(updated);
    return updated;
  }

  async markPaid(
    businessId: string,
    id: string,
    method: PaymentMethod,
    by?: string,
  ): Promise<Order> {
    const order = await this.findOneOrFail(businessId, id);
    if ([OrderStatus.Rejected, OrderStatus.Cancelled].includes(order.status)) {
      throw new BadRequestException(
        'Un pedido rechazado o cancelado no se cobra.',
      );
    }
    const result = await this.orders.update(
      { id, businessId, paymentStatus: PaymentStatus.Unpaid },
      {
        paymentStatus: PaymentStatus.Paid,
        paymentMethod: method,
        paidAt: new Date(),
        ...(by && { handledByName: by }),
      },
    );
    if (!result.affected) {
      throw new ConflictException('El pedido ya estaba pagado.');
    }
    return this.findOneOrFail(businessId, id);
  }

  /** El cliente solo puede cancelar mientras el pedido no fue aceptado. */
  async cancelByCustomer(businessId: string, token: string): Promise<Order> {
    const order = await this.findByTrackingToken(businessId, token);
    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException(
        'El pedido ya fue aceptado. Para cancelarlo comunícate con el negocio.',
      );
    }
    await this.transition(
      order,
      OrderStatus.Cancelled,
      'Cancelado por el cliente.',
    );
    const cancelled = await this.findByTrackingToken(businessId, token);
    void this.notifications.cancelledByCustomer(cancelled);
    return cancelled;
  }

  // ---------- Internos ----------

  /**
   * Cambia el estado solo si nadie lo cambió entre la lectura y la escritura
   * (por ejemplo, dos personas aceptando el mismo pedido).
   */
  private async transition(order: Order, target: OrderStatus, reason?: string) {
    const now = new Date();
    const patch: Partial<Order> = { status: target };
    if (target === OrderStatus.Accepted) patch.acceptedAt = now;
    if (target === OrderStatus.Ready) patch.readyAt = now;
    if (target === OrderStatus.Completed) patch.completedAt = now;
    if (target === OrderStatus.Rejected || target === OrderStatus.Cancelled) {
      patch.cancelledAt = now;
      patch.cancellationReason = reason ?? null;
    }

    const releases =
      target === OrderStatus.Rejected || target === OrderStatus.Cancelled;
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.update(
        Order,
        { id: order.id, businessId: order.businessId, status: order.status },
        patch,
      );
      if (!result.affected) {
        throw new ConflictException(
          'El pedido cambió de estado mientras tanto. Recarga e inténtalo de nuevo.',
        );
      }
      // Lo que se descontó del inventario vuelve a estar disponible.
      if (releases) {
        await manager.query(
          `UPDATE "catalog_variants" v
             SET "stock" = v."stock" + oi."quantity"
            FROM "order_items" oi
           WHERE oi."order_id" = $1 AND oi."stock_reserved"
             AND oi."variant_id" = v."id" AND v."stock" IS NOT NULL`,
          [order.id],
        );
      }
    });
  }

  /**
   * Descuenta las unidades de las presentaciones con inventario. Si otro
   * pedido se llevó las últimas, falla y la transacción no guarda nada.
   */
  private async reserveStock(manager: EntityManager, lines: PricedLine[]) {
    const byVariant = new Map<string, { name: string; quantity: number }>();
    for (const line of lines) {
      if (!line.tracksStock || !line.variantId) continue;
      const entry = byVariant.get(line.variantId) ?? {
        name: line.variantName
          ? `${line.itemName} (${line.variantName})`
          : line.itemName,
        quantity: 0,
      };
      entry.quantity += line.quantity;
      byVariant.set(line.variantId, entry);
    }
    for (const [variantId, { name, quantity }] of byVariant) {
      const result = await manager
        .createQueryBuilder()
        .update(Variant)
        .set({ stock: () => '"stock" - :quantity' })
        .where('id = :variantId AND "stock" >= :quantity', {
          variantId,
          quantity,
        })
        .setParameters({ quantity })
        .execute();
      if (!result.affected) {
        throw new BadRequestException(
          `Ya no quedan suficientes unidades de "${name}".`,
        );
      }
    }
  }

  private assertTypeAllowed(settings: MenuSettings, draft: OrderDraft) {
    const enabled = {
      [OrderType.DineIn]: settings.dineInEnabled,
      [OrderType.Pickup]: settings.pickupEnabled,
      [OrderType.Delivery]: settings.deliveryEnabled,
    }[draft.type];
    if (!enabled) {
      throw new BadRequestException(
        'Este negocio no acepta ese tipo de pedido.',
      );
    }
    if (draft.type === OrderType.DineIn && !draft.table && !draft.tableLabel) {
      throw new BadRequestException('Indica en qué mesa estás.');
    }
    if (draft.type !== OrderType.DineIn && (draft.table || draft.tableLabel)) {
      throw new BadRequestException('Solo los pedidos en mesa llevan mesa.');
    }
    if (draft.type === OrderType.Delivery && !draft.delivery) {
      throw new BadRequestException(
        'Un domicilio necesita la dirección de entrega.',
      );
    }
    if (draft.type !== OrderType.Delivery && draft.delivery) {
      throw new BadRequestException(
        'Solo los domicilios llevan dirección de entrega.',
      );
    }
  }

  /** En mesa, para recoger y a domicilio: efectivo o transferencia. */
  private resolvePaymentMethod(
    draft: OrderDraft,
    totalCents: number,
  ): PaymentMethod | null {
    // Cualquier forma de entrega: efectivo o transferencia (por defecto, efectivo).
    // En el local con otro medio queda para lo que registra el personal.
    const method = draft.paymentMethod ?? PaymentMethod.Cash;
    if (method !== PaymentMethod.Cash && method !== PaymentMethod.Transfer) {
      throw new BadRequestException('Paga en efectivo o por transferencia.');
    }
    if (draft.cashChangeFor !== undefined) {
      if (method !== PaymentMethod.Cash) {
        throw new BadRequestException(
          'cashChangeFor solo aplica al pago en efectivo.',
        );
      }
      if (toCents(draft.cashChangeFor) < totalCents) {
        throw new BadRequestException(
          'El monto para el cambio es menor que el total del pedido.',
        );
      }
    }
    return method;
  }

  /** Sin uso por ahora: el envío no se calcula (ver quote). */
  private async routeDistanceKm(
    business: Business,
    delivery: DeliveryInputDto,
  ): Promise<number> {
    const { latitude, longitude } = business.profile;
    if (latitude === null || longitude === null) {
      throw new BadRequestException(
        'El negocio no tiene configurada su ubicación para domicilios.',
      );
    }
    const meters = await this.distance.routeDistanceMeters(
      { latitude, longitude },
      // quote() solo llega aquí con la ubicación del cliente.
      { latitude: delivery.latitude!, longitude: delivery.longitude! },
    );
    // Se redondea hacia arriba a centésimas de km.
    return Math.ceil(meters / 10) / 100;
  }

  /**
   * Datos de contacto del pedido y cliente asociado:
   * - Cliente con cuenta: sus datos, salvo que se indiquen otros.
   * - Invitado con teléfono: se reutiliza el invitado del negocio con ese
   *   teléfono, o se crea uno. Nunca se usan clientes de otro negocio.
   * Para recoger y domicilio, nombre y teléfono son obligatorios.
   */
  private async resolveContact(
    manager: EntityManager,
    businessId: string,
    type: OrderType,
    contact: OrderContact,
  ): Promise<{
    customerId: string | null;
    name: string | null;
    phone: string | null;
  }> {
    const name = contact.contactName ?? contact.customer?.name ?? null;
    const phone = contact.contactPhone ?? contact.customer?.phone ?? null;

    if (type !== OrderType.DineIn && (!name || !phone)) {
      throw new BadRequestException(
        'Para recoger o domicilio se necesitan nombre y teléfono de contacto.',
      );
    }
    if (contact.customer) {
      return { customerId: contact.customer.id, name, phone };
    }
    if (contact.matchExisting) {
      const matched = await this.matchCustomer(
        manager,
        businessId,
        phone,
        name,
      );
      if (matched || !name) return { customerId: matched, name, phone };
      // Sin coincidencia: cliente nuevo con estos datos (sin sesión en ningún teléfono).
      const created = await manager.save(
        manager.create(Customer, { businessId, name, phone }),
      );
      return { customerId: created.id, name, phone };
    }
    if (contact.alwaysNewGuest && name) {
      const created = await manager.save(
        manager.create(Customer, { businessId, name, phone }),
      );
      return { customerId: created.id, name, phone };
    }
    if (!phone) return { customerId: null, name, phone: null };
    if (!name) {
      throw new BadRequestException('Indica el nombre junto con el teléfono.');
    }

    const guest =
      (await manager.findOne(Customer, {
        where: { businessId, phone, registeredAt: IsNull() },
        order: { createdAt: 'ASC' },
      })) ??
      (await manager.save(
        manager.create(Customer, { businessId, name, phone }),
      ));
    return { customerId: guest.id, name, phone };
  }

  /**
   * Cliente existente del negocio para un pedido del personal: teléfono
   * exacto (el más reciente, si hay varios) o, sin teléfono, nombre exacto
   * sin distinguir mayúsculas, solo si hay uno. `null` si no hay coincidencia.
   */
  private async matchCustomer(
    manager: EntityManager,
    businessId: string,
    phone: string | null,
    name: string | null,
  ): Promise<string | null> {
    if (phone) {
      const found = await manager.findOne(Customer, {
        where: { businessId, phone },
        order: { createdAt: 'DESC' },
        select: { id: true },
      });
      return found?.id ?? null;
    }
    if (!name) return null;
    const matches = await manager
      .createQueryBuilder(Customer, 'c')
      .select('c.id', 'id')
      .where('c.business_id = :businessId', { businessId })
      .andWhere('lower(c.name) = lower(:name)', { name: name.trim() })
      .limit(2)
      .getRawMany<{ id: string }>();
    return matches.length === 1 ? matches[0].id : null;
  }

  /** Bloquea la fila del negocio mientras se asigna el número. */
  private async nextOrderNumber(
    manager: EntityManager,
    businessId: string,
  ): Promise<number> {
    const raw: unknown = await manager.query(
      `UPDATE "businesses" SET "last_order_number" = "last_order_number" + 1
       WHERE "id" = $1 RETURNING "last_order_number"`,
      [businessId],
    );
    // El driver de Postgres de TypeORM devuelve [filas, cantidad] en un UPDATE.
    const rows = (
      Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw
    ) as Array<{ last_order_number: number }> | undefined;
    const number = rows?.[0]?.last_order_number;
    if (typeof number !== 'number') {
      throw new NotFoundException('Negocio no encontrado.');
    }
    return number;
  }
}
