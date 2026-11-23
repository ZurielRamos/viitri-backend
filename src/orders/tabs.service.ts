import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, type EntityManager, Repository } from 'typeorm';
import { fromCents, toCents } from '../common/money.js';
import type { MenuTable } from '../menu/entities/menu-table.entity.js';
import { OrderTab, TabStatus } from './entities/order-tab.entity.js';
import { Order } from './entities/order.entity.js';
import {
  FINAL_STATUSES,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './order.enums.js';

/** No cuentan en la cuenta. */
const VOID = [OrderStatus.Rejected, OrderStatus.Cancelled];

/**
 * La cuenta abierta de la mesa, o una nueva. Se llama dentro de la
 * transacción del pedido, con el negocio ya bloqueado (número de pedido).
 */
export async function openTabFor(
  manager: EntityManager,
  businessId: string,
  table: MenuTable,
  currency: string,
): Promise<string> {
  const open = await manager.findOne(OrderTab, {
    where: { businessId, tableId: table.id, status: TabStatus.Open },
    select: { id: true },
  });
  if (open) return open.id;
  const created = await manager.save(
    manager.create(OrderTab, {
      businessId,
      tableId: table.id,
      tableName: table.name,
      currency,
    }),
  );
  return created.id;
}

export interface TabView {
  id: string;
  tableId: string | null;
  tableName: string;
  status: TabStatus;
  currency: string;
  openedAt: Date;
  closedAt: Date | null;
  billRequestedAt: Date | null;
  /** Lo que se debe: pedidos no rechazados ni cancelados. */
  subtotal: number;
  tip: number;
  paymentMethod: PaymentMethod | null;
  orders: Order[];
}

@Injectable()
export class TabsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderTab)
    private readonly tabs: Repository<OrderTab>,
  ) {}

  /** Abiertas (las que pidieron la cuenta primero) o las cerradas más recientes. */
  async list(businessId: string, status: TabStatus): Promise<TabView[]> {
    const tabs = await this.tabs.find({
      where: { businessId, status },
      relations: { orders: { items: true } },
      order:
        status === TabStatus.Open
          ? { openedAt: 'ASC', orders: { createdAt: 'ASC' } }
          : { closedAt: 'DESC', orders: { createdAt: 'ASC' } },
      take: status === TabStatus.Open ? 100 : 30,
    });
    const views = tabs.map(present);
    if (status === TabStatus.Open) {
      views.sort(
        (a, b) =>
          Number(Boolean(b.billRequestedAt)) -
          Number(Boolean(a.billRequestedAt)),
      );
    }
    return views;
  }

  async findOneOrFail(businessId: string, id: string): Promise<TabView> {
    const tab = await this.tabs.findOne({
      where: { id, businessId },
      relations: { orders: { items: true } },
      order: { orders: { createdAt: 'ASC', items: { sortOrder: 'ASC' } } },
    });
    if (!tab) throw new NotFoundException('Cuenta no encontrada.');
    return present(tab);
  }

  /** La cuenta abierta de una mesa (para el cliente que escaneó su QR). */
  async findOpenForTable(
    businessId: string,
    tableId: string,
  ): Promise<TabView | null> {
    const tab = await this.tabs.findOne({
      where: { businessId, tableId, status: TabStatus.Open },
      relations: { orders: { items: true } },
      order: { orders: { createdAt: 'ASC', items: { sortOrder: 'ASC' } } },
    });
    return tab && present(tab);
  }

  /** "Pedir la cuenta": el equipo lo ve resaltado y recibe un aviso. */
  async requestBill(businessId: string, tableId: string): Promise<TabView> {
    const tab = await this.findOpenForTable(businessId, tableId);
    if (!tab)
      throw new NotFoundException('Esta mesa no tiene una cuenta abierta.');
    if (!tab.billRequestedAt) {
      await this.tabs.update({ id: tab.id }, { billRequestedAt: new Date() });
    }
    return this.findOneOrFail(businessId, tab.id);
  }

  /**
   * Cobra la cuenta: los pedidos quedan pagados con ese medio y entregados,
   * y se guarda la propina (voluntaria) aparte.
   */
  async close(
    businessId: string,
    id: string,
    payment: { paymentMethod: PaymentMethod; tip: number },
  ): Promise<TabView> {
    await this.dataSource.transaction(async (manager) => {
      const tab = await manager.findOne(OrderTab, {
        where: { id, businessId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tab) throw new NotFoundException('Cuenta no encontrada.');
      if (tab.status !== TabStatus.Open) {
        throw new ConflictException('Esta cuenta ya se cobró.');
      }
      const orders = await manager.find(Order, {
        where: { tabId: id, status: Not(In(VOID)) },
      });
      if (orders.some((o) => o.status === OrderStatus.Pending)) {
        throw new BadRequestException(
          'Hay pedidos por confirmar en esta cuenta: acéptalos o recházalos antes de cobrar.',
        );
      }
      const now = new Date();
      const unpaid = orders.filter(
        (o) => o.paymentStatus === PaymentStatus.Unpaid,
      );
      if (unpaid.length) {
        await manager.update(
          Order,
          { id: In(unpaid.map((o) => o.id)) },
          {
            paymentStatus: PaymentStatus.Paid,
            paymentMethod: payment.paymentMethod,
            paidAt: now,
          },
        );
      }
      const open = orders.filter((o) => !FINAL_STATUSES.includes(o.status));
      if (open.length) {
        await manager.update(
          Order,
          { id: In(open.map((o) => o.id)) },
          { status: OrderStatus.Completed, completedAt: now },
        );
      }
      const subtotalCents = orders.reduce(
        (sum, o) => sum + toCents(o.total),
        0,
      );
      await manager.update(
        OrderTab,
        { id },
        {
          status: TabStatus.Closed,
          closedAt: now,
          subtotal: fromCents(subtotalCents),
          tip: payment.tip,
          paymentMethod: payment.paymentMethod,
        },
      );
    });
    return this.findOneOrFail(businessId, id);
  }
}

function present(tab: OrderTab): TabView {
  const orders = tab.orders ?? [];
  const subtotal =
    tab.subtotal ??
    fromCents(
      orders
        .filter((o) => !VOID.includes(o.status))
        .reduce((sum, o) => sum + toCents(o.total), 0),
    );
  return {
    id: tab.id,
    tableId: tab.tableId,
    tableName: tab.tableName,
    status: tab.status,
    currency: tab.currency,
    openedAt: tab.openedAt,
    closedAt: tab.closedAt,
    billRequestedAt: tab.billRequestedAt,
    subtotal,
    tip: tab.tip,
    paymentMethod: tab.paymentMethod,
    orders,
  };
}
