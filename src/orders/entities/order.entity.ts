import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { moneyTransformer } from '../../common/money.js';
import { Customer } from '../../customers/entities/customer.entity.js';
import { MenuTable } from '../../menu/entities/menu-table.entity.js';
import {
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '../order.enums.js';
import { OrderItem } from './order-item.entity.js';
import { OrderTab } from './order-tab.entity.js';

const money = {
  type: 'numeric' as const,
  precision: 12,
  scale: 2,
  transformer: moneyTransformer,
};

@Entity({ name: 'orders' })
@Unique('uq_orders_business_number', ['businessId', 'number'])
@Index('idx_orders_business_status_created', [
  'businessId',
  'status',
  'createdAt',
])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Número visible del pedido, consecutivo por negocio. */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'enum', enum: OrderType, enumName: 'order_type' })
  type: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status' })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderSource, enumName: 'order_source' })
  source: OrderSource;

  @Index('idx_orders_customer_id')
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer> | null;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  @ManyToOne(() => MenuTable, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Relation<MenuTable> | null;

  /** Nombre de la mesa al momento del pedido. */
  /** Cuenta de la mesa a la que suma (pedidos en mesa con mesa registrada). */
  @Index('idx_orders_tab_id')
  @Column({ name: 'tab_id', type: 'uuid', nullable: true })
  tabId: string | null;

  @ManyToOne(() => OrderTab, (tab) => tab.orders, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tab_id' })
  tab: Relation<OrderTab> | null;

  @Column({ name: 'table_name', type: 'varchar', length: 60, nullable: true })
  tableName: string | null;

  @Column({
    name: 'contact_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({
    name: 'delivery_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deliveryAddress: string | null;

  /** Indicaciones: "casa azul, segundo piso". */
  @Column({
    name: 'delivery_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deliveryReference: string | null;

  /** Barrio o zona del domicilio (si el negocio cobra por zona). */
  @Column({
    name: 'delivery_zone',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  deliveryZone: string | null;

  @Column({
    name: 'delivery_latitude',
    type: 'double precision',
    nullable: true,
  })
  deliveryLatitude: number | null;

  @Column({
    name: 'delivery_longitude',
    type: 'double precision',
    nullable: true,
  })
  deliveryLongitude: number | null;

  /** Distancia de la ruta usada para calcular el costo de envío. */
  @Column({
    name: 'delivery_distance_km',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  deliveryDistanceKm: number | null;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column(money)
  subtotal: number;

  @Column({ ...money, name: 'delivery_fee', default: 0 })
  deliveryFee: number;

  @Column(money)
  total: number;

  /** Método con el que se pagó o se pagará. En mesa se define al cobrar. */
  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.Unpaid,
  })
  paymentStatus: PaymentStatus;

  /** Efectivo: con cuánto va a pagar el cliente, para llevar el cambio. */
  @Column({ ...money, name: 'cash_change_for', nullable: true })
  cashChangeFor: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Código del enlace corto de seguimiento (para los avisos por WhatsApp al cliente). */
  @Column({
    name: 'tracking_link_code',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  trackingLinkCode: string | null;

  /** Cuándo se avisó al dueño de que nadie veía este pedido pendiente. */
  @Column({ name: 'owner_alerted_at', type: 'timestamptz', nullable: true })
  ownerAlertedAt: Date | null;

  /** Quién del equipo lo tomó (pedidos creados desde el panel). */
  @Column({
    name: 'taken_by_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  takenByName: string | null;

  /** Quién del equipo le cambió el estado o lo cobró por última vez. */
  @Column({
    name: 'handled_by_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  handledByName: string | null;

  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancellationReason: string | null;

  /** SHA-256 del token de seguimiento que recibe quien hace el pedido. */
  @Column({
    name: 'tracking_token_hash',
    type: 'char',
    length: 64,
    unique: true,
    nullable: true,
    select: false,
  })
  trackingTokenHash: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: Relation<OrderItem[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
