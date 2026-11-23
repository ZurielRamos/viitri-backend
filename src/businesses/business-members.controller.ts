import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentBusinessActor } from './decorators/business-actor.decorator.js';
import { BusinessAccess } from './decorators/business-roles.decorator.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { BusinessRole } from './business-role.enum.js';
import {
  BusinessMembersService,
  type BusinessActor,
} from './business-members.service.js';

@Controller('businesses/:businessId/members')
export class BusinessMembersController {
  constructor(private readonly members: BusinessMembersService) {}

  @BusinessAccess()
  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.members.list(businessId);
  }

  @BusinessAccess(BusinessRole.Owner)
  @Patch(':userId')
  changeRole(
    @CurrentBusinessActor() actor: BusinessActor,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.changeRole(actor, businessId, userId, dto.role);
  }

  /** Las reglas finas (salir, admin vs staff) se validan en el servicio. */
  @BusinessAccess()
  @HttpCode(204)
  @Delete(':userId')
  async remove(
    @CurrentBusinessActor() actor: BusinessActor,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.members.remove(actor, businessId, userId);
  }
}
