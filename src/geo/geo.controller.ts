import { Controller, Get, Header, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { GeoService } from './geo.service.js';

/** Datos públicos y estables: se cachean un día. */
@Public()
@Controller('geo/countries/:countryCode/regions')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=86400')
  regions(@Param('countryCode') countryCode: string) {
    return this.geo
      .regions(countryCode)
      .map(({ code, name }) => ({ code, name }));
  }

  @Get(':regionCode/cities')
  @Header('Cache-Control', 'public, max-age=86400')
  cities(
    @Param('countryCode') countryCode: string,
    @Param('regionCode') regionCode: string,
  ) {
    return this.geo
      .cities(countryCode, regionCode)
      .map(({ code, name, official }) => ({
        code,
        name,
        ...(official && { official }),
      }));
  }
}
