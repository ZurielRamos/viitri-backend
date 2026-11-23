import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { addDays, localDate, zonedInstant } from '../common/zoned-time.js';

export interface DaySummary {
  date: string;
  currency: string;
  /** Pedidos que cuentan (sin rechazados ni cancelados). */
  orders: number;
  sales: number;
  /** Ticket promedio. */
  average: number;
  cancelled: number;
  tips: number;
  byType: { type: string; orders: number; sales: number }[];
  byPayment: { method: string | null; orders: number; sales: number }[];
  topItems: { name: string; quantity: number; sales: number }[];
}

const num = (value: unknown) => Number(value ?? 0);

/** Números de un día en la zona horaria del negocio. */
@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  async day(
    business: { id: string; profile: { timezone: string; currency: string } },
    date?: string,
  ): Promise<DaySummary> {
    const tz = business.profile.timezone || 'UTC';
    const day = date ?? localDate(new Date(), tz);
    const from = zonedInstant(day, 0, tz);
    const to = zonedInstant(addDays(day, 1), 0, tz);
    const params = [business.id, from, to];
    const valid = `o.business_id = $1 AND o.created_at >= $2 AND o.created_at < $3 AND o.status NOT IN ('rejected', 'cancelled')`;
    const q = <T>(sql: string) =>
      this.dataSource.query(sql, params) as Promise<T[]>;
    const [[totals], [cancelled], byType, byPayment, topItems, [tips]] =
      await Promise.all([
        q<{ orders: string; sales: string }>(
          `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS sales FROM orders o WHERE ${valid}`,
        ),
        q<{ count: string }>(
          `SELECT COUNT(*) AS count FROM orders o WHERE o.business_id = $1 AND o.created_at >= $2 AND o.created_at < $3 AND o.status IN ('rejected', 'cancelled')`,
        ),
        q<{ type: string; orders: string; sales: string }>(
          `SELECT o.type, COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o WHERE ${valid} GROUP BY o.type ORDER BY sales DESC`,
        ),
        q<{ method: string | null; orders: string; sales: string }>(
          `SELECT o.payment_method AS method, COUNT(*) AS orders, SUM(o.total) AS sales FROM orders o WHERE ${valid} GROUP BY o.payment_method ORDER BY sales DESC`,
        ),
        q<{ name: string; quantity: string; sales: string }>(
          `SELECT i.item_name AS name, SUM(i.quantity) AS quantity, SUM(i.line_total) AS sales
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE ${valid} GROUP BY i.item_name ORDER BY quantity DESC, sales DESC LIMIT 10`,
        ),
        q<{ tips: string }>(
          `SELECT COALESCE(SUM(t.tip), 0) AS tips FROM order_tabs t WHERE t.business_id = $1 AND t.closed_at >= $2 AND t.closed_at < $3`,
        ),
      ]);
    const orders = num(totals?.orders);
    const sales = num(totals?.sales);
    return {
      date: day,
      currency: business.profile.currency,
      orders,
      sales,
      average: orders ? Math.round(sales / orders) : 0,
      cancelled: num(cancelled?.count),
      tips: num(tips?.tips),
      byType: byType.map((r) => ({
        type: r.type,
        orders: num(r.orders),
        sales: num(r.sales),
      })),
      byPayment: byPayment.map((r) => ({
        method: r.method,
        orders: num(r.orders),
        sales: num(r.sales),
      })),
      topItems: topItems.map((r) => ({
        name: r.name,
        quantity: num(r.quantity),
        sales: num(r.sales),
      })),
    };
  }
}
