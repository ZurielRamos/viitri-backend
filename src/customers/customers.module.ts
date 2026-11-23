import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { Customer } from './entities/customer.entity.js';
import { CustomerAuthGuard } from './guards/customer-auth.guard.js';
import { PublicCustomersController } from './public-customers.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), BusinessesModule],
  controllers: [CustomersController, PublicCustomersController],
  providers: [CustomersService, CustomerAuthService, CustomerAuthGuard],
  exports: [CustomersService, CustomerAuthService, CustomerAuthGuard],
})
export class CustomersModule {}
