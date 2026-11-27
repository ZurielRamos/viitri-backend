import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator.js';
import type { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

/** Credenciales de los servicios externos. Solo el equipo de viitri. */
@PlatformRoles(PlatformRole.SuperAdmin)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Patch(':group')
  update(
    @CurrentUser() actor: User,
    @Param('group') group: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settings.update(group, dto.values, actor.id);
  }

  @HttpCode(200)
  @Post(':group/test')
  test(@Param('group') group: string) {
    return this.settings.test(group);
  }
}
