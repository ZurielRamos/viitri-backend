import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../businesses/entities/business.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { User } from '../users/entities/user.entity.js';

/**
 * Un celular (o navegador) con las notificaciones push activas en la tienda
 * de un negocio. Cada `{slug}.viitri.com` es un origen distinto, así que el
 * mismo celular tiene un `endpoint` por tienda. Puede ser de alguien del
 * equipo (`userId`), de un cliente (`customerId`) o de los dos, si la misma
 * persona pide y atiende desde el mismo teléfono.
 */
@Entity({ name: 'push_devices' })
export class PushDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** URL del servicio de push del navegador (FCM, APNs, Mozilla). Única. */
  @Index('uq_push_devices_endpoint', { unique: true })
  @Column({ type: 'varchar', length: 1000 })
  endpoint: string;

  @Column({ type: 'varchar', length: 200 })
  p256dh: string;

  @Column({ type: 'varchar', length: 100 })
  auth: string;

  @Index('idx_push_devices_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Alguien del equipo (dueño o colaborador) con sesión en este celular. */
  @Index('idx_push_devices_user_id')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User> | null;

  /** Cliente de la tienda con sesión en este celular. */
  @Index('idx_push_devices_customer_id')
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
