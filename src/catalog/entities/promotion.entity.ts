import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';

/**
 * Descuento por horario (happy hour): un porcentaje sobre ciertos productos
 * o categorías, en ciertos días y horas. Sin productos ni categorías, vale
 * para todo el menú.
 */
@Entity({ name: 'catalog_promotions' })
@Index('idx_catalog_promotions_business', ['businessId'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Lo que ve el cliente: "Happy hour". */
  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** 1 a 90. */
  @Column({ type: 'int' })
  percent: number;

  /** 0 = domingo … 6 = sábado. */
  @Column({ type: 'int', array: true })
  days: number[];

  /** HH:mm en la zona del negocio. Si `endTime` es menor, termina al día siguiente. */
  @Column({ name: 'start_time', type: 'varchar', length: 5 })
  startTime: string;

  @Column({ name: 'end_time', type: 'varchar', length: 5 })
  endTime: string;

  @Column({
    name: 'category_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  categoryIds: string[];

  @Column({
    name: 'item_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  itemIds: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
