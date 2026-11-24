import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { BusinessRole } from '../business-role.enum.js';
import { Business } from './business.entity.js';

@Entity({ name: 'business_members' })
@Unique('uq_business_members_business_user', ['businessId', 'userId'])
export class BusinessMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Index('idx_business_members_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: BusinessRole, enumName: 'business_role' })
  role: BusinessRole;
  /**
   * Recibe las notificaciones push de pedidos y reservas en sus celulares.
   * El dueño lo decide por colaborador; el suyo, en su propio celular.
   */
  @Column({ name: 'notify_orders', type: 'boolean', default: true })
  notifyOrders: boolean;

  @ManyToOne(() => Business, (business) => business.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
