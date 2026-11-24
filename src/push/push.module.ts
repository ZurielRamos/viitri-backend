import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import webpush from 'web-push';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  CustomerPushController,
  PublicPushKeyController,
  StaffPushController,
} from './push.controller.js';
import { PushDevice } from './push-device.entity.js';
import { PushService, WEB_PUSH_SEND } from './push.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushDevice]),
    BusinessesModule,
    CustomersModule,
  ],
  controllers: [
    PublicPushKeyController,
    StaffPushController,
    CustomerPushController,
  ],
  providers: [
    PushService,
    { provide: WEB_PUSH_SEND, useValue: webpush.sendNotification },
  ],
  exports: [PushService],
})
export class PushModule {}
