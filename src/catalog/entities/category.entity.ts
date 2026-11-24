import {
  Check,
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
import { mediaUrlTransformer } from '../../storage/media-url.js';
import { CategoryDisplayMode } from '../catalog.enums.js';

@Entity({ name: 'catalog_categories' })
@Check(
  'chk_catalog_categories_display_mode',
  `"display_mode" IN ('carousel', 'list', 'grid')`,
)
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_catalog_categories_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Foto pequeña (192 × 192) de la categoría; si no hay, se usa `icon`. */
  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
    transformer: mediaUrlTransformer,
  })
  imageUrl: string | null;

  /** Cómo se ven sus productos: fila deslizable, lista o cuadrícula. */
  @Column({
    name: 'display_mode',
    type: 'varchar',
    length: 20,
    default: CategoryDisplayMode.List,
  })
  displayMode: CategoryDisplayMode;

  /**
   * Aparece en la barra de categorías de la tienda. Si no, sus productos se
   * ven igual en su sección; solo no se puede filtrar por ella.
   */
  @Column({ name: 'show_in_bar', type: 'boolean', default: true })
  showInBar: boolean;

  /** Icono de la lista de la web ("burger", "coffee"…). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  icon: string | null;

  /** Menor primero. */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Inactiva = no se muestra al público. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
