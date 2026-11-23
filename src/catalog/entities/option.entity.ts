import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { moneyTransformer } from '../../common/money.js';
import { OptionGroup } from './option-group.entity.js';

@Entity({ name: 'catalog_options' })
@Check('chk_catalog_options_max_quantity', '"max_quantity" >= 1')
export class Option {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_catalog_options_group_id')
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => OptionGroup, (group) => group.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group: Relation<OptionGroup>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Se suma al precio del producto. 0 = sin costo. */
  @Column({
    name: 'price_delta',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: moneyTransformer,
  })
  priceDelta: number;

  /**
   * Cuántas veces se puede elegir la misma opción: 1 = sí o no ("Sin
   * cebolla"); 3 = hasta 3 porciones ("Queso extra × 3").
   */
  @Column({ name: 'max_quantity', type: 'int', default: 1 })
  maxQuantity: number;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
