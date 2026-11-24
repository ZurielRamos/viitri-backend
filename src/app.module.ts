import { AiModule } from '@nestjs/ai';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from '@nestjs/storage';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module.js';
import { createAiOptions } from './ai/ai.config.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.validation.js';
import { databaseOptions } from './database/database.options.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { MenuModule } from './menu/menu.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { createStorageOptions } from './storage/storage.config.js';
import { MediaController } from './storage/media.controller.js';
import { BillingModule } from './billing/billing.module.js';
import { LogoModule } from './logo/logo.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { TeamModule } from './team/team.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
      }),
    }),
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createStorageOptions,
    }),
    AiModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: createAiOptions,
    }),
    AuthModule,
    UsersModule,
    BusinessesModule,
    InvitationsModule,
    AdminModule,
    CustomersModule,
    CatalogModule,
    MenuModule,
    OrdersModule,
    BookingsModule,
    TeamModule,
    LogoModule,
    ScheduleModule.forRoot(),
    BillingModule,
  ],
  controllers: [AppController, MediaController],
  providers: [AppService],
})
export class AppModule {}
