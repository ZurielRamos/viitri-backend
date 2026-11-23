import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DISTANCE_PROVIDER } from './distance-provider.js';
import { GoogleRoutesDistanceProvider } from './google-routes.provider.js';
import { StraightLineDistanceProvider } from './straight-line.provider.js';

@Module({
  providers: [
    {
      provide: DISTANCE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('DISTANCE_PROVIDER', 'google') === 'straight_line'
          ? new StraightLineDistanceProvider()
          : new GoogleRoutesDistanceProvider(
              config.get<string>('GOOGLE_MAPS_API_KEY') || undefined,
            ),
    },
  ],
  exports: [DISTANCE_PROVIDER],
})
export class DeliveryModule {}
