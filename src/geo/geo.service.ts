import { readFileSync } from 'node:fs';
import { Injectable, NotFoundException } from '@nestjs/common';

export interface GeoCity {
  code: string;
  name: string;
  /** Nombre oficial, si la gente usa otro (por ejemplo, Santiago de Cali). */
  official?: string;
  lat: number;
  lng: number;
}

export interface GeoRegion {
  code: string;
  name: string;
  cities: GeoCity[];
}

/**
 * Departamentos o estados y sus municipios, por país. Hoy solo Colombia
 * (DIVIPOLA del DANE); los demás países usan texto libre.
 */
@Injectable()
export class GeoService {
  private readonly countries = new Map<string, GeoRegion[]>([
    ['CO', this.load('co')],
  ]);

  supports(countryCode: string | null | undefined): boolean {
    return Boolean(
      countryCode && this.countries.has(countryCode.toUpperCase()),
    );
  }

  regions(countryCode: string): GeoRegion[] {
    const regions = this.countries.get(countryCode.toUpperCase());
    if (!regions)
      throw new NotFoundException('No tenemos departamentos para ese país.');
    return regions;
  }

  region(countryCode: string, regionCode: string): GeoRegion | undefined {
    return this.regions(countryCode).find((r) => r.code === regionCode);
  }

  cities(countryCode: string, regionCode: string): GeoCity[] {
    const region = this.region(countryCode, regionCode);
    if (!region) throw new NotFoundException('Departamento no encontrado.');
    return region.cities;
  }

  private load(file: string): GeoRegion[] {
    const url = new URL(`./data/${file}.json`, import.meta.url);
    return (JSON.parse(readFileSync(url, 'utf8')) as { regions: GeoRegion[] })
      .regions;
  }
}
