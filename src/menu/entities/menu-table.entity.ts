import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';

/**
 * Mesa del negocio. El código QR de la mesa abre el menú con `qrToken`, y los
 * pedidos hechos desde ahí quedan asociados a la mesa.
 */
@Entity({ name: 'menu_tables' })
@Unique('uq_menu_tables_business_name', ['businessId', 'name'])
export class MenuTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Por ejemplo "5" o "Terraza 2". Único por negocio. */
  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  zone: string | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  /** Va en la URL del QR. Regenerarlo invalida los QR impresos. */
  @Column({ name: 'qr_token', type: 'varchar', length: 32, unique: true })
  qrToken: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
