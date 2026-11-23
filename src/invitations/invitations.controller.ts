import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentBusinessActor } from '../businesses/decorators/business-actor.decorator.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import type { BusinessActor } from '../businesses/business-members.service.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import type { User } from '../users/entities/user.entity.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';
import { assertPersonalAccount } from '../users/personal-account.js';

@Controller('businesses/:businessId/invitations')
export class BusinessInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Post()
  create(
    @CurrentBusinessActor() actor: BusinessActor,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(actor, businessId, dto);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Get()
  list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.invitations.listPending(businessId);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @HttpCode(204)
  @Delete(':invitationId')
  async revoke(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    await this.invitations.revoke(businessId, invitationId);
  }
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** El usuario debe estar autenticado; si no tiene cuenta, se registra antes. */
  @HttpCode(200)
  @Post('accept')
  accept(@CurrentUser() user: User, @Body() dto: AcceptInvitationDto) {
    assertPersonalAccount(user);
    return this.invitations.accept(user, dto.token);
  }
}
