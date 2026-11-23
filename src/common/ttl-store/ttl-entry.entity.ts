import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Valor con vencimiento. Las filas vencidas se ignoran y se limpian al escribir. */
@Entity({ name: 'ttl_entries' })
@Index('idx_ttl_entries_expires_at', ['expiresAt'])
export class TtlEntry {
  @PrimaryColumn({
    type: 'varchar',
    length: 255,
    primaryKeyConstraintName: 'PK_ttl_entries',
  })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
