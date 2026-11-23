import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity.js';
import { BusinessFeature } from '../business-feature.enum.js';
import { effectivePlan } from '../plans/plans.js';
import { featureSetError } from '../catalog-features/feature-catalog.js';
import type { Plan } from '../plans/plans.js';

@Injectable()
export class BusinessFeaturesService {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  async list(businessId: string): Promise<BusinessFeature[]> {
    const business = await this.businesses.findOne({
      where: { id: businessId },
      select: { id: true, features: true },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business.features;
  }

  /**
   * Activa el feature. Es idempotente y atómico: la actualización se hace en
   * una sola sentencia, sin leer y reescribir el arreglo.
   */
  async enable(
    businessId: string,
    feature: BusinessFeature,
  ): Promise<BusinessFeature[]> {
    const business = await this.state(businessId);
    const current = business.features;
    if (!current.includes(feature))
      this.assertValid([...current, feature], effectivePlan(business), [
        feature,
      ]);
    return this.mutate(
      businessId,
      `CASE WHEN :feature = ANY(features) THEN features
            ELSE array_append(features, :feature) END`,
      feature,
    );
  }

  /** Desactiva el feature. Sus datos se conservan. */
  async disable(
    businessId: string,
    feature: BusinessFeature,
  ): Promise<BusinessFeature[]> {
    // Desactivar una funcionalidad de venta no debe dejar huérfanas a las de fidelizar.
    const business = await this.state(businessId);
    this.assertValid(
      business.features.filter((f) => f !== feature),
      effectivePlan(business),
      [],
    );
    return this.mutate(businessId, 'array_remove(features, :feature)', feature);
  }

  private async state(businessId: string) {
    const business = await this.businesses.findOne({
      where: { id: businessId },
      select: {
        id: true,
        features: true,
        plan: true,
        trialEndsAt: true,
        paidUntil: true,
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    return business;
  }

  private assertValid(
    features: BusinessFeature[],
    plan: Plan,
    checked?: BusinessFeature[],
  ): void {
    const error = featureSetError(features, plan, checked);
    if (error) throw new BadRequestException(error);
  }

  isEnabled(
    business: Pick<Business, 'features'>,
    feature: BusinessFeature,
  ): boolean {
    return business.features.includes(feature);
  }

  private async mutate(
    businessId: string,
    expression: string,
    feature: BusinessFeature,
  ): Promise<BusinessFeature[]> {
    const result = await this.businesses
      .createQueryBuilder()
      .update(Business)
      .set({
        features: () =>
          expression.replaceAll(':feature', ':feature::business_feature'),
        updatedAt: () => 'now()',
      })
      .where('id = :businessId', { businessId })
      .setParameter('feature', feature)
      .execute();

    if (!result.affected) throw new NotFoundException('Negocio no encontrado.');
    // Se relee con TypeORM: `RETURNING` entrega los arreglos de enums de
    // Postgres como texto ("{a,b}") y no como arreglo.
    return this.list(businessId);
  }
}
