import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DISTANCE_PROVIDER,
  type DistanceProvider,
} from './distance-provider.js';
import { GoogleRoutesDistanceProvider } from './google-routes.provider.js';
import { StraightLineDistanceProvider } from './straight-line.provider.js';

/**
 * El proveedor y la clave se leen en cada cotización: si cambian desde el
 * panel, la siguiente ya los usa.
 */
function liveDistanceProvider(config: ConfigService): DistanceProvider {
  let cached: { key: string; provider: DistanceProvider } | null = null;
  const current = () => {
    const mode = config.get<string>('DISTANCE_PROVIDER') || 'google';
    const apiKey = config.get<string>('GOOGLE_MAPS_API_KEY') || undefined;
    const key = `${mode}|${apiKey ?? ''}`;
    if (cached?.key !== key) {
      cached = {
        key,
        provider:
          mode === 'straight_line'
            ? new StraightLineDistanceProvider()
            : new GoogleRoutesDistanceProvider(apiKey),
      };
    }
    return cached.provider;
  };
  return {
    routeDistanceMeters: (origin, destination) =>
      current().routeDistanceMeters(origin, destination),
  };
}

@Module({
  providers: [
    {
      provide: DISTANCE_PROVIDER,
      inject: [ConfigService],
      useFactory: liveDistanceProvider,
    },
  ],
  exports: [DISTANCE_PROVIDER],
})
export class DeliveryModule {}
