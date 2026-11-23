import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.js';
import { PlatformRole } from '../../users/platform-role.enum.js';
import { BusinessFeature } from '../business-feature.enum.js';
import { BUSINESS_ROLES_KEY } from '../decorators/business-roles.key.js';
import { REQUIRED_FEATURES_KEY } from '../decorators/require-features.decorator.js';
import { REQUIRED_PLAN_KEY } from '../decorators/require-plan.decorator.js';
import {
  effectivePlan,
  planDefinition,
  planIncludes,
  type Plan,
} from '../plans/plans.js';
import { BusinessRole } from '../business-role.enum.js';
import { BusinessesService } from '../businesses.service.js';

/**
 * Aislamiento entre negocios: verifica que el usuario pertenezca al negocio
 * de la ruta y deja su membresía en `request.businessMembership`.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly businesses: BusinessesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const businessId = request.params.businessId;
    if (typeof businessId !== 'string' || !isUUID(businessId)) {
      throw new NotFoundException('Negocio no encontrado.');
    }

    const roles =
      this.reflector.getAllAndOverride<BusinessRole[] | undefined>(
        BUSINESS_ROLES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    const membership = await this.businesses.findMembership(
      businessId,
      request.user.id,
    );

    if (request.user.platformRole === PlatformRole.SuperAdmin) {
      // Confirma que el negocio exista para responder 404 si no.
      await this.businesses.findByIdOrFail(businessId);
      request.businessMembership = membership;
      await this.assertFeatures(context, businessId);
      return true;
    }

    // Se responde 404 (no 403) para no revelar qué negocios existen.
    if (!membership) throw new NotFoundException('Negocio no encontrado.');
    if (roles.length && !roles.includes(membership.role)) {
      throw new ForbiddenException(
        'Tu rol en este negocio no permite esta acción.',
      );
    }

    request.businessMembership = membership;
    await this.assertFeatures(context, businessId);
    return true;
  }

  private async assertFeatures(context: ExecutionContext, businessId: string) {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<
      BusinessFeature[] | undefined
    >(REQUIRED_FEATURES_KEY, targets);
    const tier = this.reflector.getAllAndOverride<Plan | undefined>(
      REQUIRED_PLAN_KEY,
      targets,
    );
    if (!required?.length && !tier) return;
    const business = await this.businesses.findByIdOrFail(businessId);
    if (tier && !planIncludes(effectivePlan(business), tier)) {
      throw new ForbiddenException(
        `Esto está en el plan ${planDefinition(tier).name}.`,
      );
    }
    if (!required?.length) return;
    if (!required.some((f) => business.features.includes(f))) {
      throw new ForbiddenException(
        `Este módulo requiere activar uno de estos features: ${required.join(', ')}.`,
      );
    }
  }
}
