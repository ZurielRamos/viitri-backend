import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { RequireAnyFeature } from '../businesses/decorators/require-features.decorator.js';
import {
  CreateTableDto,
  UpdateMenuSettingsDto,
  UpdateTableDto,
} from './dto/menu.dto.js';
import { MenuSettingsService } from './menu-settings.service.js';
import { TablesService } from './tables.service.js';
import { RequirePlan } from '../businesses/decorators/require-plan.decorator.js';

const Manage = () => BusinessAccess(BusinessRole.Owner, BusinessRole.Admin);
const BusinessId = () => Param('businessId', ParseUUIDPipe);
const TableId = () => Param('tableId', ParseUUIDPipe);

/** Configuración y mesas del feature `menu`. */
@RequireAnyFeature(BusinessFeature.Menu)
@Controller('businesses/:businessId/menu')
export class MenuController {
  constructor(
    private readonly settings: MenuSettingsService,
    private readonly tables: TablesService,
  ) {}

  @BusinessAccess()
  @Get('settings')
  getSettings(@BusinessId() businessId: string) {
    return this.settings.get(businessId);
  }

  @Manage()
  @Patch('settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateMenuSettingsDto,
  ) {
    return this.settings.update(businessId, dto);
  }

  @BusinessAccess()
  @RequirePlan('advanced')
  @Get('tables')
  listTables(@BusinessId() businessId: string) {
    return this.tables.list(businessId);
  }

  @BusinessAccess()
  @RequirePlan('advanced')
  @Get('tables/:tableId')
  findTable(@BusinessId() businessId: string, @TableId() id: string) {
    return this.tables.findOneOrFail(businessId, id);
  }

  @Manage()
  @RequirePlan('advanced')
  @Post('tables')
  createTable(@BusinessId() businessId: string, @Body() dto: CreateTableDto) {
    return this.tables.create(businessId, dto);
  }

  @Manage()
  @RequirePlan('advanced')
  @Patch('tables/:tableId')
  updateTable(
    @BusinessId() businessId: string,
    @TableId() id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tables.update(businessId, id, dto);
  }

  @Manage()
  @HttpCode(200)
  @RequirePlan('advanced')
  @Post('tables/:tableId/regenerate-qr')
  regenerateQr(@BusinessId() businessId: string, @TableId() id: string) {
    return this.tables.regenerateQr(businessId, id);
  }

  @Manage()
  @HttpCode(204)
  @RequirePlan('advanced')
  @Delete('tables/:tableId')
  async removeTable(@BusinessId() businessId: string, @TableId() id: string) {
    await this.tables.remove(businessId, id);
  }
}
