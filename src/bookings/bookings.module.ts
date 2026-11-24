import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { Item } from '../catalog/entities/item.entity.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BookingSettingsController,
  BookingsController,
} from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingSettings } from './entities/booking-settings.entity.js';
import { Booking } from './entities/booking.entity.js';
import { Professional } from './entities/professional.entity.js';
import { PublicBookingsController } from './public-bookings.controller.js';
import { Business } from '../businesses/entities/business.entity.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PushModule } from '../push/push.module.js';
import { BookingNotificationsService } from './booking-notifications.service.js';

/** Agenda: servicios con horarios libres, profesionales y citas. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingSettings,
      Professional,
      Item,
      Business,
      BusinessMember,
    ]),
    // Avisos por WhatsApp de las reservas.
    NotificationsModule,
    // Notificaciones push al equipo y a los clientes.
    PushModule,
    BusinessesModule,
    CustomersModule,
  ],
  controllers: [
    BookingsController,
    BookingSettingsController,
    PublicBookingsController,
  ],
  providers: [BookingsService, BookingNotificationsService],
})
export class BookingsModule {}
