import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Item } from '../../catalog/entities/item.entity.js';
import { Variant } from '../../catalog/entities/variant.entity.js';
import { moneyTransformer } from '../../common/money.js';
import { Order } from './order.entity.js';

/** Opción elegida, copiada tal como estaba al momento del pedido. */
export interface OrderItemOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  /** Precio de una unidad de la opción. */
  priceDelta: number;
  /** Veces que se eligió: 2 × Queso extra. */
  quantity: number;
}

/**
 * Línea del pedido. Nombre, precio y opciones se copian del catálogo al
 * crear el pedido, para que editar o borrar el elemento no cambie pedidos
 * ya hechos.
 */
@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_order_items_order_id')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @ManyToOne(() => Item, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'item_id' })
  item: Relation<Item> | null;

  @Column({ name: 'item_name', type: 'varchar', length: 160 })
  itemName: string;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @ManyToOne(() => Variant, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<Variant> | null;

  /** "Familiar", "Talla M"; `null` si tenía una sola presentación. */
  @Column({ name: 'variant_name', type: 'varchar', length: 80, nullable: true })
  variantName: string | null;

  /** Se descontó del inventario al crear el pedido; se devuelve si se cancela. */
  @Column({ name: 'stock_reserved', type: 'boolean', default: false })
  stockReserved: boolean;

  /** Precio del producto más sus opciones, por unidad. */
  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'line_total',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  lineTotal: number;

  /** Promoción aplicada al precio: "Happy hour −20 %". */
  @Column({
    name: 'promotion_name',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  promotionName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  options: OrderItemOption[];

  /** Por ejemplo "sin cebolla". */
  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
