import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity.js';
import type { OpeningHoursRange } from '../../businesses/profile/profile.types.js';

/** Cómo recibe citas el negocio. Sin fila, valen los valores por defecto. */
@Entity({ name: 'booking_settings' })
export class BookingSettings {
  @PrimaryColumn({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Cada cuánto empieza un horario: 15, 30 o 60 minutos. */
  @Column({ name: 'slot_interval_minutes', type: 'int', default: 30 })
  slotIntervalMinutes: number;

  /** Con cuánto tiempo de anticipación se puede pedir una cita. */
  @Column({ name: 'min_notice_minutes', type: 'int', default: 60 })
  minNoticeMinutes: number;

  /** Hasta cuántos días adelante se puede agendar. */
  @Column({ name: 'max_days_ahead', type: 'int', default: 30 })
  maxDaysAhead: number;

  /** Las citas de los clientes llegan pendientes y el negocio las confirma. */
  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval: boolean;

  /** Usa el horario de atención del negocio; si no, `hours`. */
  @Column({ name: 'use_business_hours', type: 'boolean', default: true })
  useBusinessHours: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  hours: OpeningHoursRange[];

  /** Reservas de mesa: cuánto se guarda la mesa. */
  @Column({ name: 'reservation_duration_minutes', type: 'int', default: 90 })
  reservationDurationMinutes: number;

  /** Reservas de mesa que se reciben a la misma hora. */
  @Column({ name: 'reservations_per_slot', type: 'int', default: 5 })
  reservationsPerSlot: number;

  /** Personas como máximo por reserva; grupos más grandes, por WhatsApp. */
  @Column({ name: 'max_party_size', type: 'int', default: 10 })
  maxPartySize: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
