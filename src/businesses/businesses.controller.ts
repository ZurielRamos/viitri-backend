import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { User } from '../users/entities/user.entity.js';
import { BusinessAccess } from './decorators/business-roles.decorator.js';
import { CreateBusinessDto } from './dto/create-business.dto.js';
import { SlugAvailabilityQueryDto } from './dto/slug-availability.dto.js';
import { StartTrialDto } from './dto/start-trial.dto.js';
import { UpdateBusinessDto } from './dto/update-business.dto.js';
import { BusinessRole } from './business-role.enum.js';
import { BusinessesService } from './businesses.service.js';
import { assertPersonalAccount } from '../users/personal-account.js';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  /** Cualquier usuario autenticado puede crear negocios y queda como owner. */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBusinessDto) {
    assertPersonalAccount(user);
    return this.businesses.create(user, dto);
  }

  /** Negocios del usuario actual con su rol en cada una. */
  @Get()
  findMine(@CurrentUser() user: User) {
    return this.businesses.findForUser(user.id);
  }

  /** Pública: el registro la revisa antes de que exista la cuenta. */
  @Public()
  @Get('slug-availability')
  async slugAvailability(@Query() query: SlugAvailabilityQueryDto) {
    return {
      slug: query.slug,
      available: await this.businesses.isSlugAvailable(query.slug),
    };
  }

  @BusinessAccess()
  @Get(':businessId')
  findOne(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.businesses.findByIdOrFail(businessId);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Patch(':businessId')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businesses.update(businessId, dto);
  }

  /** Probar Avanzado o Pro gratis 14 días (una vez por negocio). */
  @BusinessAccess(BusinessRole.Owner)
  @HttpCode(200)
  @Post(':businessId/trial')
  startTrial(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: StartTrialDto,
  ) {
    return this.businesses.startTrial(businessId, dto.plan);
  }
}
