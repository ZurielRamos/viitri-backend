import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { NotificationChannel } from '../../notifications/notification-channel.enum.js';
import { Business } from '../../businesses/entities/business.entity.js';
import { BusinessRole } from '../../businesses/business-role.enum.js';
import { User } from '../../users/entities/user.entity.js';
import { InvitationStatus } from '../invitation-status.enum.js';

@Entity({ name: 'business_invitations' })
export class BusinessInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_business_invitations_business_id')
  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel',
  })
  channel: NotificationChannel;

  /** Email (canal email) o teléfono en formato E.164 (whatsapp/sms). */
  @Column({ type: 'varchar', length: 254 })
  recipient: string;

  @Column({ type: 'enum', enum: BusinessRole, enumName: 'business_role' })
  role: BusinessRole;

  /** SHA-256 del token enviado. El token en claro nunca se guarda. */
  @Column({
    name: 'token_hash',
    type: 'char',
    length: 64,
    unique: true,
    select: false,
  })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    enumName: 'invitation_status',
    default: InvitationStatus.Pending,
  })
  status: InvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById: string | null;

  @Column({ name: 'accepted_by_id', type: 'uuid', nullable: true })
  acceptedById: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy: Relation<User> | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'accepted_by_id' })
  acceptedBy: Relation<User> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
