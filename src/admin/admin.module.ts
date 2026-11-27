import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { User } from '../users/entities/user.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, BusinessMember]),
    UsersModule,
    BusinessesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
