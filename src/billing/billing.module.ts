import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PushModule } from '../push/push.module.js';
import {
  BillingController,
  WompiWebhookController,
} from './billing.controller.js';
import { BillingReminders } from './billing-reminders.js';
import { BillingService } from './billing.service.js';
import { PlanPayment } from './plan-payment.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanPayment, Business, BusinessMember]),
    // AuthModule: el almacén con vencimiento evita repetir avisos.
    AuthModule,
    BusinessesModule,
    NotificationsModule,
    // Avisos del plan y de los pagos en el celular del dueño.
    PushModule,
  ],
  controllers: [BillingController, WompiWebhookController],
  providers: [BillingService, BillingReminders],
})
export class BillingModule {}
