import { GeoService } from '../../geo/geo.service.js';
import { Business } from '../entities/business.entity.js';
import { specialtiesError } from './profile-options.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from '../entities/business-profile.entity.js';
import type { UpdateBusinessProfileDto } from './dto/update-business-profile.dto.js';
import {
  findHolidayHoursError,
  findOpeningHoursError,
} from './opening-hours.js';

@Injectable()
export class BusinessProfileService {
  constructor(
    @InjectRepository(BusinessProfile)
    private readonly profiles: Repository<BusinessProfile>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    private readonly geo: GeoService,
  ) {}

  async findByBusinessIdOrFail(businessId: string): Promise<BusinessProfile> {
    const profile = await this.profiles.findOneBy({ businessId });
    if (!profile) throw new NotFoundException('Perfil no encontrado.');
    return profile;
  }

  async update(
    businessId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfile> {
    const profile = await this.findByBusinessIdOrFail(businessId);
    if (dto.specialties) {
      const business = await this.businesses.findOneOrFail({
        where: { id: businessId },
        select: { id: true, businessType: true },
      });
      const error = specialtiesError(business.businessType, dto.specialties);
      if (error) throw new BadRequestException(error);
    }

    // Solo se copian los campos presentes en la petición.
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (profile as unknown as Record<string, unknown>)[key] = value;
      }
    }

    // Coordenadas: van las dos o ninguna.
    if ((profile.latitude === null) !== (profile.longitude === null)) {
      throw new BadRequestException(
        'latitude y longitude se envían juntas, o ninguna.',
      );
    }

    if (dto.openingHours) {
      const error = findOpeningHoursError(dto.openingHours);
      if (error) throw new BadRequestException(error);
      profile.openingHours = [...dto.openingHours]
        .map(({ day, open, close }) => ({ day, open, close }))
        .sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
    }

    this.applyGeoCodes(profile, dto);
    if (dto.holidayHours) {
      const error = findHolidayHoursError(dto.holidayHours);
      if (error) throw new BadRequestException(error);
      profile.holidayHours = [...dto.holidayHours]
        .map(({ open, close }) => ({ open, close }))
        .sort((a, b) => a.open.localeCompare(b.open));
    }
    if (dto.socialLinks) {
      // Guarda solo las redes informadas, sin claves vacías.
      profile.socialLinks = Object.fromEntries(
        Object.entries(dto.socialLinks).filter(([, url]) => url),
      );
    }

    return this.profiles.save(profile);
  }

  /**
   * En países con datos (Colombia), los códigos mandan: el nombre del
   * departamento y del municipio se toman de la lista oficial.
   */
  private applyGeoCodes(
    profile: BusinessProfile,
    dto: UpdateBusinessProfileDto,
  ): void {
    if (dto.regionCode === undefined && dto.cityCode === undefined) return;
    const country = profile.countryCode;
    if (!this.geo.supports(country)) {
      profile.regionCode = null;
      profile.cityCode = null;
      return;
    }
    const region = profile.regionCode
      ? this.geo.region(country!, profile.regionCode)
      : undefined;
    if (profile.regionCode && !region) {
      throw new BadRequestException('Elige un departamento de la lista.');
    }
    const city = profile.cityCode
      ? region?.cities.find((c) => c.code === profile.cityCode)
      : undefined;
    if (profile.cityCode && !city) {
      throw new BadRequestException(
        'Elige un municipio del departamento elegido.',
      );
    }
    profile.region = region?.name ?? null;
    profile.city = city?.name ?? null;
  }
}
