import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Item } from './item.entity.js';

/** Lo propio de un servicio que se agenda (funcionalidad `bookings`). */
@Entity({ name: 'catalog_service_details' })
@Check(
  'chk_catalog_service_details_minutes',
  '"duration_minutes" > 0 AND "buffer_minutes" >= 0',
)
export class ServiceDetails {
  @PrimaryColumn({
    name: 'item_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_catalog_service_details',
  })
  itemId: string;

  @OneToOne(() => Item, (item) => item.service, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'fk_catalog_service_details_item',
  })
  item: Relation<Item>;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  /** Tiempo libre después de cada cita, para limpiar o preparar. */
  @Column({ name: 'buffer_minutes', type: 'int', default: 0 })
  bufferMinutes: number;
}
