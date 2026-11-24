import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { storeUrl } from '../common/store-url.js';
import { MenuSettingsService } from '../menu/menu-settings.service.js';
import {
  WhatsappNotificationsService,
  cop,
  firstName,
} from '../notifications/whatsapp/whatsapp-notifications.service.js';
import { PushService, storeIcon } from '../push/push.service.js';
import { Order } from './entities/order.entity.js';
import { OrderSource, OrderStatus, OrderType } from './order.enums.js';

/** Minutos sin que nadie del equipo vea un pedido pendiente antes de avisar al dueño. */
const UNSEEN_MINUTES = 2;
/** Pasado este tiempo ya no se avisa (el pedido es viejo: alguien lo verá en la app). */
const UNSEEN_LIMIT_MINUTES = 30;
/** El enlace de seguimiento del cliente dura lo mismo que su interés en el pedido. */
const TRACKING_LINK_DAYS = 30;

/** "domicilio", "recoger" o la mesa. */
function orderHow(order: Order): string {
  return order.type === OrderType.Delivery
    ? 'domicilio'
    : order.type === OrderType.Pickup
      ? 'recoger'
      : order.tableName
        ? `la ${order.tableName}`
        : 'mesa';
}

function productCount(order: Order): string {
  const count = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0);
  return count === 1 ? '1 producto' : `${count} productos`;
}

/**
 * Avisos de los pedidos. Push: al equipo apenas llega un pedido de la tienda
 * (o el cliente lo cancela) y al cliente en cada cambio de estado. WhatsApp:
 * al cliente cuando lo hace y cuando cambia de estado (aceptado, listo, en
 * camino, rechazado), y al dueño si llega uno que pide aceptarse y nadie lo
 * ve en la app. Nunca lanzan.
 */
@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly settings: MenuSettingsService,
    private readonly push: PushService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {}

  /**
   * El cliente hizo un pedido desde la tienda: el enlace de seguimiento queda
   * guardado (su token no se puede volver a armar) y se le confirma.
   */
  async placed(
    business: Business,
    order: Order,
    trackingToken: string,
  ): Promise<void> {
    if (order.source !== OrderSource.Customer) return;
    try {
      const store = await this.withProfile(business);
      const who = order.contactName?.trim();
      await this.push.toStaff(business.id, {
        title: `Pedido nuevo #${order.number}`,
        body: [
          who,
          productCount(order),
          orderHow(order),
          cop(Number(order.total), order.currency),
        ]
          .filter(Boolean)
          .join(' · '),
        url: `/configuracion/pedidos/${order.id}`,
        tag: `order-${order.id}`,
        icon: storeIcon(store),
      });
    } catch (error) {
      this.logger.warn(`Push del pedido ${order.id}: ${String(error)}`);
    }
    if (!order.contactPhone) return;
    try {
      const code = await this.whatsapp.link(
        storeUrl(this.config, business.slug, `/pedido/${trackingToken}`),
        TRACKING_LINK_DAYS,
      );
      await this.orders.update({ id: order.id }, { trackingLinkCode: code });
      await this.whatsapp.send('pedidoRecibido', order.contactPhone, {
        header: [String(order.number)],
        body: [
          firstName(order.contactName),
          business.name,
          cop(Number(order.total), order.currency),
        ],
        buttons: [{ code }],
      });
    } catch (error) {
      this.logger.warn(`Aviso del pedido ${order.id}: ${String(error)}`);
    }
  }

  /** El pedido cambió de estado: se le cuenta al cliente lo que cambia para él. */
  async statusChanged(order: Order): Promise<void> {
    try {
      await this.notifyStatus(order);
    } catch (error) {
      this.logger.warn(`Aviso del pedido ${order.id}: ${String(error)}`);
    }
  }

  private async notifyStatus(order: Order): Promise<void> {
    const business = await this.businesses.findOne({
      where: { id: order.businessId },
      relations: { profile: true },
    });
    if (!business) return;
    await this.pushStatus(business, order);
    if (!order.trackingLinkCode || !order.contactPhone) return;
    const who = firstName(order.contactName);
    const button = [{ code: order.trackingLinkCode }];
    const number = String(order.number);
    switch (order.status) {
      case OrderStatus.Accepted: {
        const settings = await this.settings.get(order.businessId);
        const minutes =
          order.type === OrderType.Delivery
            ? settings.deliveryEstimatedMinutes
            : order.type === OrderType.Pickup
              ? settings.pickupEstimatedMinutes
              : null;
        await this.whatsapp.send('pedidoAceptado', order.contactPhone, {
          body: [
            who,
            business.name,
            number,
            minutes ? `${minutes} minutos` : 'unos minutos',
          ],
          buttons: button,
        });
        return;
      }
      case OrderStatus.Ready:
        // En mesa se lo llevan y a domicilio avisa "en camino": "listo" es para recoger.
        if (order.type !== OrderType.Pickup) return;
        await this.whatsapp.send('pedidoListo', order.contactPhone, {
          body: [who, number, business.name],
          buttons: button,
        });
        return;
      case OrderStatus.OutForDelivery:
        await this.whatsapp.send('pedidoEnCamino', order.contactPhone, {
          body: [who, number, business.name],
          buttons: button,
        });
        return;
      case OrderStatus.Rejected:
        await this.whatsapp.send('pedidoRechazado', order.contactPhone, {
          body: [
            who,
            business.name,
            number,
            order.cancellationReason?.trim() ||
              'no lo pudimos atender en este momento',
          ],
          // Al menú de la tienda, para pedir otra cosa.
          buttons: [
            { url: storeUrl(this.config, business.slug, '/'), days: 7 },
          ],
        });
        return;
      default:
        return;
    }
  }

  /** El cliente canceló su pedido antes de que lo aceptaran: el equipo deja de prepararlo. */
  async cancelledByCustomer(order: Order): Promise<void> {
    try {
      const business = await this.businesses.findOne({
        where: { id: order.businessId },
        relations: { profile: true },
      });
      if (!business) return;
      await this.push.toStaff(business.id, {
        title: `Pedido #${order.number} cancelado`,
        body: `${order.contactName?.trim() || 'El cliente'} canceló su pedido.`,
        url: `/configuracion/pedidos/${order.id}`,
        tag: `order-${order.id}`,
        icon: storeIcon(business),
      });
    } catch (error) {
      this.logger.warn(`Push del pedido ${order.id}: ${String(error)}`);
    }
  }

  /** Push al cliente en cada cambio de estado de su pedido. */
  private async pushStatus(business: Business, order: Order): Promise<void> {
    if (!order.customerId) return;
    const n = `#${order.number}`;
    const reason = order.cancellationReason?.trim();
    let title: string;
    let body: string;
    switch (order.status) {
      case OrderStatus.Accepted: {
        const settings = await this.settings.get(order.businessId);
        const minutes =
          order.type === OrderType.Delivery
            ? settings.deliveryEstimatedMinutes
            : order.type === OrderType.Pickup
              ? settings.pickupEstimatedMinutes
              : null;
        title = 'Pedido aceptado';
        body = `${business.name} aceptó tu pedido ${n}.${minutes ? ` Estará en unos ${minutes} minutos.` : ''}`;
        break;
      }
      case OrderStatus.Preparing:
        title = 'Estamos preparando tu pedido';
        body = `${business.name} ya está preparando tu pedido ${n}.`;
        break;
      case OrderStatus.Ready:
        title = 'Tu pedido está listo';
        body =
          order.type === OrderType.Pickup
            ? `Ya puedes recoger tu pedido ${n} en ${business.name}.`
            : order.type === OrderType.Delivery
              ? `Tu pedido ${n} está listo y pronto sale hacia tu dirección.`
              : `Tu pedido ${n} ya va para tu mesa.`;
        break;
      case OrderStatus.OutForDelivery:
        title = 'Tu pedido va en camino';
        body = `El pedido ${n} de ${business.name} ya salió hacia tu dirección.`;
        break;
      case OrderStatus.Completed:
        title = '¡Gracias por tu pedido!';
        body = `${business.name} marcó tu pedido ${n} como entregado.`;
        break;
      case OrderStatus.Rejected:
        title = 'No pudimos atender tu pedido';
        body = `${business.name} no pudo atender tu pedido ${n}${reason ? `: ${reason}` : '.'}`;
        break;
      case OrderStatus.Cancelled:
        title = 'Tu pedido fue cancelado';
        body = `${business.name} canceló tu pedido ${n}${reason ? `: ${reason}` : '.'}`;
        break;
      default:
        return;
    }
    await this.push.toCustomer(order.customerId, {
      title,
      body,
      url: `/mis-pedidos/${order.id}`,
      tag: `order-${order.id}`,
      icon: storeIcon(business),
    });
  }

  private async withProfile(business: Business): Promise<Business> {
    if (business.profile) return business;
    return (
      (await this.businesses.findOne({
        where: { id: business.id },
        relations: { profile: true },
      })) ?? business
    );
  }

  /**
   * Cada minuto: pedidos que esperan ser aceptados y que nadie vio en
   * {@link UNSEEN_MINUTES} minutos. Se avisa al dueño una sola vez por pedido.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async alertUnseen(now = new Date()): Promise<void> {
    try {
      // Se marcan primero (en una sola sentencia): dos instancias no avisan dos veces.
      const rows: { id: string }[] = await this.dataSource.query(
        `UPDATE "orders" SET "owner_alerted_at" = now()
          WHERE "status" = 'pending' AND "owner_alerted_at" IS NULL
            AND "created_at" <= $1 AND "created_at" > $2
          RETURNING "id"`,
        [
          new Date(now.getTime() - UNSEEN_MINUTES * 60_000),
          new Date(now.getTime() - UNSEEN_LIMIT_MINUTES * 60_000),
        ],
      );
      for (const { id } of Array.isArray(rows[0])
        ? (rows[0] as { id: string }[])
        : rows) {
        await this.alertOwner(id);
      }
    } catch (error) {
      this.logger.error('Falló el aviso de pedidos sin ver', error as Error);
    }
  }

  private async alertOwner(orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) return;
    const business = await this.businesses.findOneBy({ id: order.businessId });
    const owner = await this.members.findOne({
      where: { businessId: order.businessId, role: BusinessRole.Owner },
      relations: { user: true },
    });
    if (!business || !owner?.user.phone) return;
    await this.whatsapp.send('pedidoNuevo', owner.user.phone, {
      header: [String(order.number)],
      body: [
        business.name,
        productCount(order),
        orderHow(order),
        cop(Number(order.total), order.currency),
      ],
      buttons: [
        {
          url: storeUrl(
            this.config,
            business.slug,
            `/configuracion/pedidos/${order.id}`,
          ),
          days: 7,
        },
      ],
    });
  }
}
