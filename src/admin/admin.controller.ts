import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UsersService } from '../users/users.service.js';
import { AdminService } from './admin.service.js';
import { ChangePlanDto } from './dto/change-plan.dto.js';
import { CreateAdminUserDto } from './dto/create-admin-user.dto.js';
import { ListBusinessesQueryDto } from './dto/list-businesses.dto.js';
import { ListUsersQueryDto } from './dto/list-users.dto.js';
import { SetPaidUntilDto } from './dto/set-paid-until.dto.js';
import { SetPhoneDto } from './dto/set-phone.dto.js';
import { UpdatePlatformRoleDto } from './dto/update-platform-role.dto.js';

/**
 * Gestión de la plataforma, por encima de los negocios.
 * Para operar dentro de un negocio concreto, el super_admin usa las mismas
 * rutas `/businesses/:businessId/...`, que le dan acceso aunque no sea miembro.
 */
@PlatformRoles(PlatformRole.SuperAdmin)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly businesses: BusinessesService,
  ) {}

  /** Cifras del resumen del panel. */
  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.admin.createUser(dto);
  }

  @Get('users/:userId')
  getUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.getUser(userId);
  }

  @Patch('users/:userId/platform-role')
  setPlatformRole(
    @CurrentUser() actor: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdatePlatformRoleDto,
  ) {
    if (actor.id === userId && dto.platformRole !== PlatformRole.SuperAdmin) {
      throw new BadRequestException(
        'No puedes quitarte a ti mismo el rol super_admin.',
      );
    }
    return this.users.setPlatformRole(userId, dto.platformRole);
  }

  /**
   * Cambia el WhatsApp con el que entra una cuenta (soporte). Sus sesiones
   * abiertas se cierran: entra de nuevo con el número nuevo.
   */
  @Patch('users/:userId/phone')
  setPhone(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetPhoneDto,
  ) {
    return this.users.setPhone(userId, dto.phone);
  }

  @Get('businesses')
  listBusinesses(@Query() query: ListBusinessesQueryDto) {
    return this.admin.listBusinesses(query);
  }

  @Get('businesses/:businessId')
  getBusiness(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.admin.getBusiness(businessId);
  }

  /** Cambio de plan manual, hasta que exista el cobro en línea. */
  @Patch('businesses/:businessId/plan')
  changePlan(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.businesses.changePlan(businessId, dto.plan);
  }

  /** Pagado hasta: mientras no haya cobro en línea, se marca a mano. */
  @Patch('businesses/:businessId/paid-until')
  setPaidUntil(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: SetPaidUntilDto,
  ) {
    return this.businesses.setPaidUntil(
      businessId,
      dto.paidUntil ? new Date(dto.paidUntil) : null,
    );
  }
}
