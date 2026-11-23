import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator.js';
import { PaginationQueryDto, paginated } from '../common/pagination.dto.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import type { User } from '../users/entities/user.entity.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UsersService } from '../users/users.service.js';
import { ChangePlanDto } from './dto/change-plan.dto.js';
import { SetPaidUntilDto } from './dto/set-paid-until.dto.js';
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
    private readonly users: UsersService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get('users')
  async listUsers(@Query() query: PaginationQueryDto) {
    return paginated(
      await this.users.findAll({ skip: query.skip, take: query.limit }),
      query,
    );
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

  @Get('businesses')
  async listBusinesses(@Query() query: PaginationQueryDto) {
    return paginated(
      await this.businesses.findAll({ skip: query.skip, take: query.limit }),
      query,
    );
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
