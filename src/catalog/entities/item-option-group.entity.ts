import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Item } from './item.entity.js';
import { OptionGroup } from './option-group.entity.js';

/** Qué grupos de opciones tiene cada elemento, y en qué orden. */
@Entity({ name: 'catalog_item_option_groups' })
export class ItemOptionGroup {
  @PrimaryColumn({
    name: 'item_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_catalog_item_option_groups',
  })
  itemId: string;

  @Index('idx_catalog_item_option_groups_group_id')
  @PrimaryColumn({
    name: 'group_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_catalog_item_option_groups',
  })
  groupId: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Item, (item) => item.optionGroupLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'fk_catalog_item_option_groups_item',
  })
  item: Relation<Item>;

  @ManyToOne(() => OptionGroup, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'group_id',
    foreignKeyConstraintName: 'fk_catalog_item_option_groups_group',
  })
  group: Relation<OptionGroup>;
}
