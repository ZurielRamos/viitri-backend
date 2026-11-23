import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { BusinessMember } from '../../businesses/entities/business-member.entity.js';
import { Business } from '../../businesses/entities/business.entity.js';
import { PlatformRole } from '../platform-role.enum.js';
import type { Acquisition, ReferralSource } from '../referral-source.js';

@Entity({ name: 'users' })
@Index('uq_users_team_pin', ['teamBusinessId', 'pinLookup'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Se guarda siempre en minúsculas. Nulo en los perfiles del equipo (PIN). */
  @Column({ type: 'varchar', length: 254, unique: true, nullable: true })
  email: string | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  /** Nulo en las cuentas creadas con WhatsApp, que no tienen contraseña. */
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Solo dígitos con indicativo de país, por ejemplo 573001234567. */
  @Index('uq_users_phone', { unique: true })
  @Column({ type: 'varchar', length: 15, nullable: true })
  phone: string | null;

  /** `sub` de la cuenta de Google vinculada. */
  @Index('uq_users_google_sub', { unique: true })
  @Column({ name: 'google_sub', type: 'varchar', length: 255, nullable: true })
  googleSub: string | null;

  @Column({
    name: 'platform_role',
    type: 'enum',
    enum: PlatformRole,
    enumName: 'platform_role',
    default: PlatformRole.User,
  })
  platformRole: PlatformRole;

  /** Constancia de la aceptación de términos y del tratamiento de datos. */
  @Column({ name: 'terms_accepted_at', type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  /** Autorización de marketing. Nulo si no la dio. */
  @Column({ name: 'marketing_opt_in_at', type: 'timestamptz', nullable: true })
  marketingOptInAt: Date | null;

  /** Respuesta a "¿Cómo nos conociste?". */
  @Column({
    name: 'referral_source',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  referralSource: ReferralSource | null;

  /** UTM y página de origen de la primera visita. */
  @Column({ type: 'jsonb', nullable: true })
  acquisition: Acquisition | null;

  /** Cuándo creó su negocio gratis. Borrarlo o transferirlo no da otro. */
  @Column({
    name: 'free_business_claimed_at',
    type: 'timestamptz',
    nullable: true,
  })
  freeBusinessClaimedAt: Date | null;

  /** Cuándo terminó u omitió la bienvenida. Nulo: aún debe verla. */
  @Column({ name: 'onboarded_at', type: 'timestamptz', nullable: true })
  onboardedAt: Date | null;

  /**
   * Perfil del equipo de un negocio: entra con su nombre y un PIN desde el
   * enlace del equipo, sin correo ni celular. Solo pertenece a ese negocio y
   * se borra con él. Nulo en las cuentas normales.
   */
  @Index('idx_users_team_business_id')
  @Column({ name: 'team_business_id', type: 'uuid', nullable: true })
  teamBusinessId: string | null;

  @ManyToOne(() => Business, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'team_business_id' })
  teamBusiness?: Relation<Business> | null;

  /**
   * HMAC del PIN con el negocio: con él se encuentra a la persona solo con
   * su PIN, por eso es único en cada negocio. Solo en los perfiles del equipo.
   */
  @Column({
    name: 'pin_lookup',
    type: 'char',
    length: 64,
    nullable: true,
    select: false,
  })
  pinLookup: string | null;

  /**
   * Sube al cambiar el PIN: las sesiones abiertas con el PIN anterior dejan
   * de servir. Va en el token como `sv`.
   */
  @Column({ name: 'session_version', type: 'int', default: 0 })
  sessionVersion: number;

  @OneToMany(() => BusinessMember, (member) => member.user)
  memberships: Relation<BusinessMember[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
