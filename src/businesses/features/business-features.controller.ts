import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { BusinessAccess } from '../decorators/business-roles.decorator.js';
import { BusinessFeature } from '../business-feature.enum.js';
import { BusinessRole } from '../business-role.enum.js';
import { BusinessFeaturesService } from './business-features.service.js';

const featurePipe = new ParseEnumPipe(BusinessFeature);

@Controller('businesses/:businessId/features')
export class BusinessFeaturesController {
  constructor(private readonly features: BusinessFeaturesService) {}

  @BusinessAccess()
  @Get()
  async list(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return { features: await this.features.list(businessId) };
  }

  /** Activa un feature. Solo owner (o super_admin). */
  @BusinessAccess(BusinessRole.Owner)
  @Put(':feature')
  async enable(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('feature', featurePipe) feature: BusinessFeature,
  ) {
    return { features: await this.features.enable(businessId, feature) };
  }

  /** Desactiva un feature sin borrar sus datos. Solo owner (o super_admin). */
  @BusinessAccess(BusinessRole.Owner)
  @Delete(':feature')
  async disable(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('feature', featurePipe) feature: BusinessFeature,
  ) {
    return { features: await this.features.disable(businessId, feature) };
  }
}
