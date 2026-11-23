import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { Item } from '../../catalog/entities/item.entity.js';
import { PriceType } from '../../catalog/catalog.enums.js';
import { moneyTransformer } from '../../common/money.js';
import { Customer } from '../../customers/entities/customer.entity.js';
import { BookingKind, BookingSource, BookingStatus } from '../booking.enums.js';
import { Professional } from './professional.entity.js';

/**
 * Una cita. Guarda el servicio, su precio y duración y el profesional como
 * estaban al agendar: cambiarlos después no cambia las citas ya tomadas.
 */
@Entity({ name: 'bookings' })
@Unique('uq_bookings_business_number', ['businessId', 'number'])
@Index('idx_bookings_business_starts', ['businessId', 'startsAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Número visible, consecutivo por negocio. */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'enum', enum: BookingStatus, enumName: 'booking_status' })
  status: BookingStatus;

  @Column({ type: 'enum', enum: BookingSource, enumName: 'booking_source' })
  source: BookingSource;

  @Column({ type: 'varchar', length: 10, default: BookingKind.Service })
  kind: BookingKind;

  /** Reservas de mesa: cuántas personas. */
  @Column({ name: 'party_size', type: 'int', nullable: true })
  partySize: number | null;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @ManyToOne(() => Item, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'item_id' })
  item: Relation<Item> | null;

  @Column({ name: 'service_name', type: 'varchar', length: 160 })
  serviceName: string;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'buffer_minutes', type: 'int', default: 0 })
  bufferMinutes: number;

  @Column({ name: 'price_type', type: 'varchar', length: 20 })
  priceType: PriceType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  price: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Index('idx_bookings_professional')
  @Column({ name: 'professional_id', type: 'uuid', nullable: true })
  professionalId: string | null;

  @ManyToOne(() => Professional, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professional_id' })
  professional: Relation<Professional> | null;

  @Column({
    name: 'professional_name',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  professionalName: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  /** Fin de la cita más su tiempo libre: hasta aquí está ocupado. */
  @Column({ name: 'blocked_until', type: 'timestamptz' })
  blockedUntil: Date;

  @Index('idx_bookings_customer')
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer> | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 120 })
  contactName: string;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  cancelReason: string | null;

  @Index('idx_bookings_tracking', { unique: true })
  @Column({ name: 'tracking_token_hash', type: 'char', length: 64 })
  trackingTokenHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
