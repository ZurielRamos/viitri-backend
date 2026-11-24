import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../businesses/entities/business.entity.js';
import type { Plan } from '../businesses/plans/plans.js';

export type PlanPaymentStatus =
  'pending' | 'approved' | 'declined' | 'voided' | 'error';

/** Datos de facturación del pagador (también se guardan en el negocio para la próxima vez). */
export interface BillingDetails {
  fullName: string;
  email: string;
  legalIdType: string;
  legalId: string;
}

/**
 * Un pago de un plan con Wompi. Se crea pendiente al abrir el checkout y lo
 * resuelve el evento `transaction.updated`: si se aprueba, el plan queda
 * pagado un mes más.
 */
@Entity({ name: 'plan_payments' })
export class PlanPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_plan_payments_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business?: Relation<Business>;

  @Column({ type: 'varchar', length: 10 })
  plan: Plan;

  /** Meses que cubre (por ahora, siempre 1). */
  @Column({ type: 'int', default: 1 })
  months: number;

  @Column({ name: 'amount_in_cents', type: 'int' })
  amountInCents: number;

  @Column({ type: 'char', length: 3, default: 'COP' })
  currency: string;

  /** Referencia única que va a Wompi y vuelve en el evento. */
  @Column({ type: 'varchar', length: 40, unique: true })
  reference: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: PlanPaymentStatus;

  @Column({
    name: 'wompi_transaction_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  wompiTransactionId: string | null;

  /** NEQUI, CARD, PSE, BANCOLOMBIA_TRANSFER… */
  @Column({
    name: 'payment_method_type',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  paymentMethodType: string | null;

  @Column({ type: 'jsonb' })
  billing: BillingDetails;

  /** El período que pagó (solo si se aprobó). */
  @Column({ name: 'period_start', type: 'timestamptz', nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'timestamptz', nullable: true })
  periodEnd: Date | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
