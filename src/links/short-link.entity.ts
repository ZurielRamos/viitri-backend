import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Enlace corto `https://viitri.com/ir/{código}`. Los botones de las
 * plantillas de WhatsApp solo admiten una variable al final de una URL fija,
 * así que llevan este código y la web lo convierte en la dirección real (la
 * tienda, su plan, un pedido…).
 */
@Entity({ name: 'short_links' })
export class ShortLink {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  /** Después de esta fecha el enlace ya no sirve (por ejemplo, el seguimiento de un pedido). */
  @Index('idx_short_links_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
