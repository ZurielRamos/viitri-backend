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
 * Quien atiende las citas. Cada uno tiene su agenda: dos profesionales
 * pueden atender a la misma hora. Sin profesionales, el negocio atiende una
 * cita a la vez.
 */
@Entity({ name: 'booking_professionals' })
@Index('idx_booking_professionals_business', ['businessId', 'sortOrder'])
export class Professional {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Servicios que hace. Vacío: todos. */
  @Column({
    name: 'service_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  serviceIds: string[];

  /** Inactivo: no recibe citas nuevas; las que tiene se conservan. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
