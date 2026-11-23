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
import { Item } from './item.entity.js';

/**
 * Presentación de un elemento con su propio precio y stock: "Personal" y
 * "Familiar", o "Talla M". Un elemento sin presentaciones tiene una sola
 * variante sin nombre, que el editor muestra solo como "Precio".
 */
@Entity({ name: 'catalog_variants' })
@Check('chk_catalog_variants_stock', '"stock" IS NULL OR "stock" >= 0')
export class Variant {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_catalog_variants',
  })
  id: string;

  @Index('idx_catalog_variants_item_id')
  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => Item, (item) => item.variants, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'fk_catalog_variants_item',
  })
  item: Relation<Item>;

  /** `null` en la variante única. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  name: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  price: number;

  /** Precio de antes, tachado, para mostrar un descuento. */
  @Column({
    name: 'compare_at_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  compareAtPrice: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  /** Unidades disponibles. `null` = no se lleva inventario. */
  @Column({ type: 'int', nullable: true })
  stock: number | null;

  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
