import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [UsersModule, BusinessesModule],
  controllers: [AdminController],
})
export class AdminModule {}
