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
import { Business } from '../../businesses/entities/business.entity.js';

/**
 * Cliente final de un negocio. Cada registro pertenece a un solo negocio:
 * la misma persona en dos negocios son dos clientes sin relación.
 *
 * - Invitado: sin contraseña (`registeredAt` es null). Lo crea el personal o
 *   el flujo de compra o reserva.
 * - Con cuenta: tiene email y contraseña. El email es único entre las
 *   cuentas de un mismo negocio; los invitados pueden repetirlo.
 */
@Entity({ name: 'customers' })
@Index('uq_customers_business_account_email', ['businessId', 'email'], {
  unique: true,
  where: '"password_hash" IS NOT NULL',
})
@Index('idx_customers_business_phone', ['businessId', 'phone'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_customers_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** En minúsculas. */
  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  /** E.164. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  /** Última dirección de entrega: se precarga en el siguiente pedido. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({
    name: 'address_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressReference: string | null;

  /** Momento en que el cliente creó su cuenta. `null` = invitado. */
  @Column({ name: 'registered_at', type: 'timestamptz', nullable: true })
  registeredAt: Date | null;

  /** Notas internas del negocio. Nunca se muestran al cliente. */
  @Column({ type: 'text', nullable: true, select: false })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
