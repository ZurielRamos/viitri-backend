import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { openStatus } from './profile/open-status.js';
import { canTakeOrders, effectivePlan, planIncludes } from './plans/plans.js';
import { BusinessFeature } from './business-feature.enum.js';
import { BusinessesService } from './businesses.service.js';

/** Endpoints públicos. El negocio se resuelve por slug en la ruta. */
@Public()
@Controller('public/businesses')
export class PublicBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const business = await this.businesses.findBySlugOrFail(slug);
    const {
      businessId: _businessId,
      updatedAt: _updatedAt,
      ...profile
    } = business.profile;
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      features: business.features,
      profile,
      // Abierto o cerrado ahora, según su horario, zona horaria y festivos.
      openStatus: openStatus(business.profile),
      // Lo que su plan vigente permite: en Básico el menú es solo para ver.
      capabilities: {
        orders: canTakeOrders(business),
        tableReservations:
          business.features.includes(BusinessFeature.TableReservations) &&
          planIncludes(effectivePlan(business), 'pro'),
      },
    };
  }
}
