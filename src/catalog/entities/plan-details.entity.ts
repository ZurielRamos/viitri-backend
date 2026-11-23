import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { PlanInterval } from '../catalog.enums.js';
import { Item } from './item.entity.js';
import { PlanBenefit } from './plan-benefit.entity.js';

/**
 * Lo propio de un plan que se cobra cada cierto tiempo (funcionalidad
 * `memberships`). El precio de cada cobro está en su variante.
 */
@Entity({ name: 'catalog_plan_details' })
@Check(
  'chk_catalog_plan_details_values',
  `"interval" IN ('week', 'month', 'year') AND "interval_count" >= 1 AND "trial_days" >= 0`,
)
export class PlanDetails {
  @PrimaryColumn({
    name: 'item_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_catalog_plan_details',
  })
  itemId: string;

  @OneToOne(() => Item, (item) => item.plan, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'fk_catalog_plan_details_item',
  })
  item: Relation<Item>;

  /** Cada `intervalCount` semanas, meses o años: mensual = 1 mes. */
  @Column({ type: 'varchar', length: 10, default: PlanInterval.Month })
  interval: PlanInterval;

  @Column({ name: 'interval_count', type: 'int', default: 1 })
  intervalCount: number;

  /** Días gratis antes del primer cobro. */
  @Column({ name: 'trial_days', type: 'int', default: 0 })
  trialDays: number;

  @OneToMany(() => PlanBenefit, (benefit) => benefit.plan)
  benefits: Relation<PlanBenefit[]>;
}
