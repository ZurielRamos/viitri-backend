import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Credencial guardada desde el panel del equipo. Tiene prioridad sobre el `.env`. */
@Entity({ name: 'platform_settings' })
export class PlatformSetting {
  /** Nombre de la variable, por ejemplo SMTP_HOST. */
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
    primaryKeyConstraintName: 'pk_platform_settings',
  })
  key: string;

  /** Cifrado con settings-crypto.ts. */
  @Column({ type: 'text' })
  value: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
