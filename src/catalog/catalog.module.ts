import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { MenuImportService } from './menu-import/menu-import.service.js';
import { CatalogImagesService } from './catalog-images.service.js';
import { CatalogController } from './catalog.controller.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';
import { ItemOptionGroup } from './entities/item-option-group.entity.js';
import { Item } from './entities/item.entity.js';
import { OptionGroup } from './entities/option-group.entity.js';
import { Option } from './entities/option.entity.js';
import { PlanBenefit } from './entities/plan-benefit.entity.js';
import { PlanDetails } from './entities/plan-details.entity.js';
import { Promotion } from './entities/promotion.entity.js';
import { ServiceDetails } from './entities/service-details.entity.js';
import { Variant } from './entities/variant.entity.js';
import { ItemsService } from './items.service.js';
import { OptionGroupsService } from './option-groups.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicCatalogService } from './public-catalog.service.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Item,
      Variant,
      ServiceDetails,
      PlanDetails,
      PlanBenefit,
      OptionGroup,
      Option,
      ItemOptionGroup,
      Promotion,
    ]),
    BusinessesModule,
    // Límite diario de lecturas de cartas (almacén con vencimiento).
    AuthModule,
  ],
  controllers: [CatalogController, PublicCatalogController],
  providers: [
    MenuImportService,
    CategoriesService,
    CatalogImagesService,
    ItemsService,
    OptionGroupsService,
    PublicCatalogService,
    PromotionsService,
  ],
  exports: [ItemsService, OptionGroupsService, PromotionsService],
})
export class CatalogModule {}
