import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { moneyTransformer } from '../../common/money.js';
import { MenuTable } from '../../menu/entities/menu-table.entity.js';
import { PaymentMethod } from '../order.enums.js';
import { Order } from './order.entity.js';

export enum TabStatus {
  Open = 'open',
  Closed = 'closed',
}

const money = {
  type: 'numeric' as const,
  precision: 12,
  scale: 2,
  transformer: moneyTransformer,
};

/**
 * Cuenta de una mesa: junta los pedidos que se van haciendo (rondas) hasta
 * que se cobra. Una mesa tiene a lo sumo una cuenta abierta.
 */
@Entity({ name: 'order_tabs' })
@Index('idx_order_tabs_business_status', ['businessId', 'status'])
@Index('uq_order_tabs_open_table', ['tableId'], {
  unique: true,
  where: `"status" = 'open'`,
})
export class OrderTab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  @ManyToOne(() => MenuTable, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Relation<MenuTable> | null;

  @Column({ name: 'table_name', type: 'varchar', length: 60 })
  tableName: string;

  @Column({
    type: 'enum',
    enum: TabStatus,
    enumName: 'order_tab_status',
    default: TabStatus.Open,
  })
  status: TabStatus;

  @Column({ type: 'char', length: 3 })
  currency: string;

  /** El cliente pidió la cuenta desde su celular. */
  @Column({ name: 'bill_requested_at', type: 'timestamptz', nullable: true })
  billRequestedAt: Date | null;

  /** Suma de los pedidos (sin propina), al cerrar. */
  @Column({ ...money, nullable: true })
  subtotal: number | null;

  /** Propina voluntaria, si el cliente la aceptó. */
  @Column({ ...money, default: 0 })
  tip: number;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @CreateDateColumn({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => Order, (order) => order.tab)
  orders: Relation<Order[]>;
}
