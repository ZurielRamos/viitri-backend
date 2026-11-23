import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PublicTeamController, TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, BusinessMember]),
    AuthModule,
    BusinessesModule,
  ],
  controllers: [TeamController, PublicTeamController],
  providers: [TeamService],
})
export class TeamModule {}
