import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from '../businesses/entities/business-profile.entity.js';
import { findTiersError } from '../delivery/delivery-fee.js';
import type { UpdateMenuSettingsDto } from './dto/menu.dto.js';
import { MenuSettings } from './entities/menu-settings.entity.js';

@Injectable()
export class MenuSettingsService {
  constructor(
    @InjectRepository(MenuSettings)
    private readonly settings: Repository<MenuSettings>,
    @InjectRepository(BusinessProfile)
    private readonly profiles: Repository<BusinessProfile>,
  ) {}

  /** Crea la configuración con valores por defecto si todavía no existe. */
  async get(businessId: string): Promise<MenuSettings> {
    await this.settings
      .createQueryBuilder()
      .insert()
      .values({ businessId })
      .orIgnore()
      .execute();
    return this.settings.findOneByOrFail({ businessId });
  }

  async update(
    businessId: string,
    dto: UpdateMenuSettingsDto,
  ): Promise<MenuSettings> {
    const settings = await this.get(businessId);
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (settings as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (dto.deliveryFeeTiers) {
      const error = findTiersError(dto.deliveryFeeTiers);
      if (error) throw new BadRequestException(error);
      settings.deliveryFeeTiers = dto.deliveryFeeTiers.map(
        ({ upToKm, fee }) => ({ upToKm, fee }),
      );
    }

    if (dto.deliveryZones) {
      const names = dto.deliveryZones.map((z) => z.name.toLowerCase());
      if (new Set(names).size !== names.length) {
        throw new BadRequestException('Hay dos barrios con el mismo nombre.');
      }
      settings.deliveryZones = dto.deliveryZones.map(({ name, fee }) => ({
        name,
        fee,
      }));
    }
    if (
      settings.deliveryFeeMode === 'fixed' &&
      settings.deliveryFixedFee === null
    ) {
      throw new BadRequestException('Escribe el valor del domicilio.');
    }
    if (
      settings.deliveryFeeMode === 'zones' &&
      !settings.deliveryZones.length
    ) {
      throw new BadRequestException('Agrega al menos un barrio con su valor.');
    }

    return this.settings.save(settings);
  }
}
