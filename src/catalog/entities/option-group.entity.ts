import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { Option } from './option.entity.js';

/**
 * Grupo de opciones reutilizable entre productos. Cubre:
 * - Preferencias: elección obligatoria, por ejemplo "Término de la carne"
 *   (mínimo 1, máximo 1).
 * - Adicionales: extras opcionales con precio, por ejemplo "Extras"
 *   (mínimo 0, máximo 5).
 */
@Entity({ name: 'catalog_option_groups' })
@Check(
  'chk_catalog_option_groups_select_range',
  '"min_select" >= 0 AND "max_select" >= 1 AND "min_select" <= "max_select"',
)
export class OptionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_catalog_option_groups_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Cuántas opciones debe elegir el cliente como mínimo. 0 = opcional. */
  @Column({ name: 'min_select', type: 'int', default: 0 })
  minSelect: number;

  /** Cuántas opciones puede elegir como máximo. */
  @Column({ name: 'max_select', type: 'int', default: 1 })
  maxSelect: number;

  @OneToMany(() => Option, (option) => option.group)
  options: Relation<Option[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
