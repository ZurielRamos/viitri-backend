import { DEFAULT_THEME, type StoreTheme } from '../profile/theme.js';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import type {
  HolidayHoursRange,
  OpeningHoursRange,
  SocialLinks,
} from '../profile/profile.types.js';
import { Business } from './business.entity.js';

/**
 * Datos públicos del negocio. Relación 1 a 1 con `businesses`: se crea junto con
 * el negocio y se borra con él.
 */
@Entity({ name: 'business_profiles' })
export class BusinessProfile {
  @PrimaryColumn({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @OneToOne(() => Business, (business) => business.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 2048, nullable: true })
  coverUrl: string | null;

  /** E.164. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  /** E.164. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  whatsapp: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({
    name: 'address_line',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressLine: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  /** Estado, provincia o departamento. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  /** Código oficial del departamento o estado (en Colombia, DANE: 05). */
  @Column({ name: 'region_code', type: 'varchar', length: 10, nullable: true })
  regionCode: string | null;

  /** Código oficial del municipio (en Colombia, DANE: 05001). */
  @Column({ name: 'city_code', type: 'varchar', length: 10, nullable: true })
  cityCode: string | null;

  /** ISO 3166-1 alpha-2, por ejemplo PA. */
  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  /** ISO 4217, por ejemplo USD. */
  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  /** Zona horaria IANA, usada para interpretar los horarios. */
  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  @Column({ name: 'opening_hours', type: 'jsonb', default: () => "'[]'" })
  openingHours: OpeningHoursRange[];

  /** Horario en días festivos. Vacío: cerrado en festivos. */
  @Column({ name: 'holiday_hours', type: 'jsonb', default: () => "'[]'" })
  holidayHours: HolidayHoursRange[];

  @Column({ name: 'social_links', type: 'jsonb', default: () => "'{}'" })
  socialLinks: SocialLinks;

  /** "¿Qué ofreces?": ids de profile-options.ts, hasta 3. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  specialties: string[];

  /** "¿Cómo atiendes?": en el local, para llevar, domicilios. */
  @Column({
    name: 'service_modes',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  serviceModes: string[];

  /** "¿Cómo te pagan?" */
  @Column({
    name: 'payment_methods',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  paymentMethods: string[];

  /** Diseño de la tienda pública. */
  @Column({
    type: 'jsonb',
    default: () => `'${JSON.stringify(DEFAULT_THEME)}'`,
  })
  theme: StoreTheme;

  /**
   * Pasos de la configuración asistida que el dueño confirmó y que no se
   * pueden deducir de los datos, porque su valor por defecto también es
   * válido (por ejemplo, "el domicilio lo confirmo yo" o "solo efectivo").
   */
  @Column({
    name: 'setup_confirmed',
    type: 'jsonb',
    default: () => "'[]'",
  })
  setupConfirmed: string[];

  /** Año en que empezó el negocio. */
  @Column({ name: 'founded_year', type: 'smallint', nullable: true })
  foundedYear: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
