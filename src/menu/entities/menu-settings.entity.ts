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
import { moneyTransformer } from '../../common/money.js';
import type { DeliveryFeeTier } from '../../delivery/delivery-fee.js';

/** Configuración del feature `menu`. Se crea la primera vez que se consulta. */
export type DeliveryFeeMode = 'to_confirm' | 'fixed' | 'zones';
export interface DeliveryZone {
  name: string;
  fee: number;
}

@Entity({ name: 'menu_settings' })
export class MenuSettings {
  @PrimaryColumn({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  /** Interruptor manual para pausar los pedidos de clientes. */
  @Column({ name: 'is_accepting_orders', type: 'boolean', default: true })
  isAcceptingOrders: boolean;

  /**
   * Si está activo, los pedidos de clientes quedan en `pending` hasta que el
   * personal los acepte. Si no, entran directo como `accepted`.
   */
  @Column({ name: 'require_order_acceptance', type: 'boolean', default: false })
  requireOrderAcceptance: boolean;

  @Column({ name: 'dine_in_enabled', type: 'boolean', default: true })
  dineInEnabled: boolean;

  @Column({ name: 'pickup_enabled', type: 'boolean', default: true })
  pickupEnabled: boolean;

  /** Activo por defecto: el domicilio solo pide la dirección. */
  @Column({ name: 'delivery_enabled', type: 'boolean', default: true })
  deliveryEnabled: boolean;

  @Column({ name: 'pickup_estimated_minutes', type: 'int', nullable: true })
  pickupEstimatedMinutes: number | null;

  @Column({ name: 'delivery_estimated_minutes', type: 'int', nullable: true })
  deliveryEstimatedMinutes: number | null;

  /** Subtotal mínimo para pedir a domicilio. `null` = sin mínimo. */
  @Column({
    name: 'delivery_min_order',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  deliveryMinOrder: number | null;

  /** Tramos de precio por km, ordenados de menor a mayor. */
  @Column({
    name: 'delivery_fee_tiers',
    type: 'jsonb',
    default: () => "'[]'",
  })
  deliveryFeeTiers: DeliveryFeeTier[];

  /**
   * Cómo se cobra el domicilio: `to_confirm` (el negocio lo confirma con el
   * cliente), `fixed` (un solo valor) o `zones` (un valor por barrio o zona).
   */
  @Column({
    name: 'delivery_fee_mode',
    type: 'varchar',
    length: 12,
    default: 'to_confirm',
  })
  deliveryFeeMode: DeliveryFeeMode;

  @Column({
    name: 'delivery_fixed_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  deliveryFixedFee: number | null;

  /** Barrios o zonas con su valor: [{ name: 'Laureles', fee: 3000 }]. */
  @Column({ name: 'delivery_zones', type: 'jsonb', default: () => "'[]'" })
  deliveryZones: DeliveryZone[];

  /** A dónde transferir: "Nequi 300 123 4567 a nombre de Ana". Lo ve el cliente al elegir transferencia. */
  @Column({
    name: 'transfer_instructions',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  transferInstructions: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
