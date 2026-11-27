import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { PlatformSetting } from './platform-setting.entity.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting, User])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
