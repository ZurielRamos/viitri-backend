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
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import {
  CreateTeamProfileDto,
  TeamLoginDto,
  UpdateTeamProfileDto,
} from './dto/team.dto.js';
import { TeamService } from './team.service.js';

const BusinessId = () => Param('businessId', ParseUUIDPipe);
const ProfileId = () => Param('profileId', ParseUUIDPipe);

/** El equipo con PIN. Solo el dueño lo administra. */
@BusinessAccess(BusinessRole.Owner)
@Controller('businesses/:businessId/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  overview(@BusinessId() businessId: string) {
    return this.team.overview(businessId);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() dto: CreateTeamProfileDto) {
    return this.team.create(businessId, dto);
  }

  @Patch(':profileId')
  update(
    @BusinessId() businessId: string,
    @ProfileId() profileId: string,
    @Body() dto: UpdateTeamProfileDto,
  ) {
    return this.team.update(businessId, profileId, dto);
  }

  @HttpCode(204)
  @Delete(':profileId')
  async remove(
    @BusinessId() businessId: string,
    @ProfileId() profileId: string,
  ) {
    await this.team.remove(businessId, profileId);
  }

  /** Enlace nuevo; el anterior deja de servir. */
  @HttpCode(200)
  @Post('key')
  regenerateKey(@BusinessId() businessId: string) {
    return this.team.regenerateKey(businessId);
  }
}

/**
 * Entrada del equipo solo con el PIN: desde el enlace del equipo (con su
 * clave) o desde la hoja "Entrar" de la tienda. Nunca se listan los nombres.
 */
@Public()
@Controller('public/businesses/:slug/team')
export class PublicTeamController {
  constructor(private readonly team: TeamService) {}

  @HttpCode(200)
  @Post('login')
  login(@Param('slug') slug: string, @Body() dto: TeamLoginDto) {
    return this.team.login(slug, null, dto);
  }

  @HttpCode(200)
  @Post(':key/login')
  loginWithKey(
    @Param('slug') slug: string,
    @Param('key') key: string,
    @Body() dto: TeamLoginDto,
  ) {
    return this.team.login(slug, key, dto);
  }
}
