import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { BusinessFeature } from '../business-feature.enum.js';
import type { BusinessType } from '../business-type.js';
import { DEFAULT_PLAN, type Plan } from '../plans/plans.js';
import { BusinessMember } from './business-member.entity.js';
import { BusinessProfile } from './business-profile.entity.js';

@Entity({ name: 'businesses' })
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Identificador público en la URL. Único y editable. */
  @Column({ type: 'varchar', length: 63, unique: true })
  slug: string;

  /** Features activos. Se modifican con BusinessFeaturesService. */
  @Column({
    type: 'enum',
    enum: BusinessFeature,
    enumName: 'business_feature',
    array: true,
    default: () => "'{}'",
  })
  features: BusinessFeature[];

  /** Plan que paga el negocio. Define funcionalidades y tamaño del equipo. */
  @Column({ type: 'varchar', length: 10, default: DEFAULT_PLAN })
  plan: Plan;

  /**
   * Primer negocio del usuario: no paga mientras siga en Básico. Si sube de
   * plan, paga el plan nuevo.
   */
  @Column({ name: 'free_basic', type: 'boolean', default: false })
  freeBasic: boolean;

  /** Tipo de negocio elegido al crearlo. */
  @Column({
    name: 'business_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  businessType: BusinessType | null;

  /** Último número de pedido emitido. Los pedidos se numeran 1, 2, 3… por negocio. */
  @Column({
    name: 'last_order_number',
    type: 'int',
    default: 0,
    select: false,
  })
  lastOrderNumber: number;

  @OneToMany(() => BusinessMember, (member) => member.business)
  members: Relation<BusinessMember[]>;

  @OneToOne(() => BusinessProfile, (profile) => profile.business)
  profile: Relation<BusinessProfile>;

  /** Fin de la prueba gratis de Avanzado o Pro. Nulo: nunca tuvo prueba. */
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  /**
   * Pagado hasta (lo marca el super admin, mientras no haya cobro en línea).
   * Sin prueba ni pago vigentes, Avanzado y Pro funcionan como Básico.
   */
  @Column({ name: 'paid_until', type: 'timestamptz', nullable: true })
  paidUntil: Date | null;

  /**
   * Clave del enlace del equipo ({slug}.dominio/equipo/{clave}). Con ella se
   * ven los nombres del equipo; para entrar, además, el PIN de cada uno.
   */
  @Column({
    name: 'team_key',
    type: 'varchar',
    length: 32,
    unique: true,
    nullable: true,
    select: false,
  })
  teamKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
