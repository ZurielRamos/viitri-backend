import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { BusinessProfile } from '../businesses/entities/business-profile.entity.js';
import { MenuSettings } from './entities/menu-settings.entity.js';
import { MenuTable } from './entities/menu-table.entity.js';
import { MenuSettingsService } from './menu-settings.service.js';
import { MenuController } from './menu.controller.js';
import { PublicMenuController } from './public-menu.controller.js';
import { TablesService } from './tables.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuSettings, MenuTable, BusinessProfile]),
    BusinessesModule,
  ],
  controllers: [MenuController, PublicMenuController],
  providers: [MenuSettingsService, TablesService],
  exports: [MenuSettingsService, TablesService],
})
export class MenuModule {}
