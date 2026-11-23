import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { UsersModule } from '../users/users.module.js';
import { BusinessInvitation } from './entities/business-invitation.entity.js';
import {
  InvitationsController,
  BusinessInvitationsController,
} from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessInvitation]),
    BusinessesModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [BusinessInvitationsController, InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
