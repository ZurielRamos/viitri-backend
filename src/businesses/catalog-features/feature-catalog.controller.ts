import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { BUSINESS_TYPES } from '../business-type.js';
import {
  BILLING_PERIOD,
  CURRENCY,
  PLAN_DEFINITIONS,
  PLAN_FEATURE_LIMITS,
} from '../plans/plans.js';
import {
  MAX_SPECIALTIES,
  PAYMENT_METHODS,
  SERVICE_MODES,
  SPECIALTIES,
} from '../profile/profile-options.js';
import {
  BUSINESS_TYPE_PRESETS,
  isBusinessTypeAvailable,
  FEATURE_CATALOG,
} from './feature-catalog.js';

/** Catálogo de funcionalidades y plantillas por tipo de negocio. Público. */
@Public()
@Controller('feature-catalog')
export class FeatureCatalogController {
  @Get()
  get() {
    return {
      plans: PLAN_DEFINITIONS,
      /** `false`: el plan no limita las funcionalidades (todas se pueden activar). */
      planFeatureLimits: PLAN_FEATURE_LIMITS,
      currency: CURRENCY,
      billingPeriod: BILLING_PERIOD,
      // Las retiradas no se muestran.
      features: FEATURE_CATALOG.filter((f) => f.status !== 'retired'),
      presets: BUSINESS_TYPE_PRESETS,
      profileOptions: {
        specialties: SPECIALTIES,
        maxSpecialties: MAX_SPECIALTIES,
        serviceModes: SERVICE_MODES,
        paymentMethods: PAYMENT_METHODS,
      },
      businessTypes: BUSINESS_TYPES.map((id) => ({
        id,
        status: isBusinessTypeAvailable(id) ? 'available' : 'coming_soon',
      })),
    };
  }
}
