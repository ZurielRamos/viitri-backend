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
import { Item } from './item.entity.js';
import { PlanDetails } from './plan-details.entity.js';

/**
 * Lo que incluye un plan, por cada cobro: "4 × Masaje relajante" (apunta al
 * servicio y lleva la cantidad) o un texto libre como "Acceso a la zona
 * húmeda".
 */
@Entity({ name: 'catalog_plan_benefits' })
@Check(
  'chk_catalog_plan_benefits_quantity',
  '"quantity" IS NULL OR "quantity" >= 1',
)
export class PlanBenefit {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_catalog_plan_benefits',
  })
  id: string;

  @Index('idx_catalog_plan_benefits_plan_item_id')
  @Column({ name: 'plan_item_id', type: 'uuid' })
  planItemId: string;

  @ManyToOne(() => PlanDetails, (plan) => plan.benefits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'plan_item_id',
    referencedColumnName: 'itemId',
    foreignKeyConstraintName: 'fk_catalog_plan_benefits_plan',
  })
  plan: Relation<PlanDetails>;

  @Column({ type: 'varchar', length: 160 })
  label: string;

  /** Servicio o producto incluido; `null` en un beneficio de texto libre. */
  @Column({ name: 'included_item_id', type: 'uuid', nullable: true })
  includedItemId: string | null;

  @ManyToOne(() => Item, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'included_item_id',
    foreignKeyConstraintName: 'fk_catalog_plan_benefits_included_item',
  })
  includedItem: Relation<Item> | null;

  /** Usos por cobro; `null` = ilimitado. */
  @Column({ type: 'int', nullable: true })
  quantity: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
