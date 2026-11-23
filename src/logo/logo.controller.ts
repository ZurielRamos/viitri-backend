import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { LogoGeneratorService } from './logo-generator.service.js';
import { publicQuestionnaire } from './logo-questionnaire.js';
import { GenerateLogoDto } from './logo.dto.js';

@Controller()
export class LogoController {
  constructor(private readonly logos: LogoGeneratorService) {}

  /** Preguntas y opciones del creador de logos. */
  @Public()
  @Get('logo/questionnaire')
  questionnaire() {
    return publicQuestionnaire();
  }

  /** Tres opciones de logo según las respuestas. No guarda nada. */
  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @HttpCode(200)
  @Post('businesses/:businessId/logo/generate')
  generate(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: GenerateLogoDto,
  ) {
    return this.logos.generate(businessId, dto);
  }
}
