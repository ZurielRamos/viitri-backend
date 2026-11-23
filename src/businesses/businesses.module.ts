import { GeoModule } from '../geo/geo.module.js';
import { BusinessImagesService } from './profile/business-images.service.js';
import { ThemeSuggestionService } from './profile/theme-suggestion.service.js';
import { FeatureCatalogController } from './catalog-features/feature-catalog.controller.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { BusinessMember } from './entities/business-member.entity.js';
import { BusinessProfile } from './entities/business-profile.entity.js';
import { Business } from './entities/business.entity.js';
import { BusinessFeaturesController } from './features/business-features.controller.js';
import { BusinessFeaturesService } from './features/business-features.service.js';
import { BusinessAccessGuard } from './guards/business-access.guard.js';
import { BusinessProfileController } from './profile/business-profile.controller.js';
import { BusinessProfileService } from './profile/business-profile.service.js';
import { PublicBusinessesController } from './public-businesses.controller.js';
import { BusinessMembersController } from './business-members.controller.js';
import { BusinessMembersService } from './business-members.service.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, BusinessMember, BusinessProfile]),
    UsersModule,
    GeoModule,
  ],
  controllers: [
    BusinessesController,
    BusinessMembersController,
    BusinessProfileController,
    BusinessFeaturesController,
    PublicBusinessesController,
    FeatureCatalogController,
  ],
  providers: [
    BusinessesService,
    BusinessMembersService,
    BusinessProfileService,
    BusinessImagesService,
    ThemeSuggestionService,
    BusinessFeaturesService,
    BusinessAccessGuard,
  ],
  exports: [BusinessesService, BusinessFeaturesService, BusinessAccessGuard],
})
export class BusinessesModule {}
