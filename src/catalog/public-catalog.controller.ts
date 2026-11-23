import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { enabledKinds } from './catalog.enums.js';
import { PublicCatalogService } from './public-catalog.service.js';

@Public()
@Controller('public/businesses/:slug/catalog')
export class PublicCatalogController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly catalog: PublicCatalogService,
  ) {}

  /**
   * Solo los tipos de sus funcionalidades activas: sin `bookings` no se ven
   * los servicios. 404 si no tiene ninguna funcionalidad de catálogo.
   */
  @Get()
  async get(@Param('slug') slug: string) {
    const business = await this.businesses.findBySlugOrFail(slug);
    const kinds = enabledKinds(business.features);
    if (!kinds.length) {
      throw new NotFoundException('Este negocio no tiene catálogo.');
    }
    return this.catalog.get(business.id, kinds);
  }
}
