import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import { mediaUrlListTransformer } from '../../storage/media-url.js';
import { ItemKind, PriceType } from '../catalog.enums.js';
import { Category } from './category.entity.js';
import { ItemOptionGroup } from './item-option-group.entity.js';
import { PlanDetails } from './plan-details.entity.js';
import { ServiceDetails } from './service-details.entity.js';
import { Variant } from './variant.entity.js';

/**
 * Elemento del catálogo: producto, servicio o plan. El precio y el stock
 * están en sus variantes; siempre tiene al menos una.
 */
@Entity({ name: 'catalog_items' })
@Index('idx_catalog_items_business_category', ['businessId', 'categoryId'])
@Index('idx_catalog_items_business_kind', ['businessId', 'kind'])
@Index('uq_catalog_items_business_slug', ['businessId', 'slug'], {
  unique: true,
})
@Check('chk_catalog_items_kind', `"kind" IN ('product', 'service', 'plan')`)
@Check(
  'chk_catalog_items_price_type',
  `"price_type" IN ('fixed', 'from', 'free', 'on_request')`,
)
export class Item {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_catalog_items',
  })
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_catalog_items_business',
  })
  business: Relation<Business>;

  @Column({ type: 'varchar', length: 20, default: ItemKind.Product })
  kind: ItemKind;

  /** Al borrar la categoría, el elemento queda sin categoría. */
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'fk_catalog_items_category',
  })
  category: Relation<Category> | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  /**
   * Parte de su enlace en la tienda ({slug}.dominio/producto/{slug}), único
   * en el negocio. Sale del nombre y cambia si el nombre cambia.
   */
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'price_type',
    type: 'varchar',
    length: 20,
    default: PriceType.Fixed,
  })
  priceType: PriceType;

  /** La primera es la principal. */
  @Column({
    name: 'image_urls',
    type: 'jsonb',
    default: () => "'[]'",
    transformer: mediaUrlListTransformer,
  })
  imageUrls: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Inactivo = oculto al público (borrador o retirado). */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** No disponible = visible pero no se puede pedir ("agotado"). */
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @OneToMany(() => Variant, (variant) => variant.item)
  variants: Relation<Variant[]>;

  @OneToMany(() => ItemOptionGroup, (link) => link.item)
  optionGroupLinks: Relation<ItemOptionGroup[]>;

  @OneToOne(() => ServiceDetails, (details) => details.item)
  service: Relation<ServiceDetails> | null;

  @OneToOne(() => PlanDetails, (details) => details.item)
  plan: Relation<PlanDetails> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Borrado lógico: nunca se borra un elemento de verdad (los pedidos y
   * planes lo siguen nombrando). TypeORM lo excluye de todas las consultas.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
