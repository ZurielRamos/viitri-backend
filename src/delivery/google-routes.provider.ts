import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DistanceProvider, LatLng } from './distance-provider.js';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const TIMEOUT_MS = 5000;

/**
 * Distancia de la ruta en auto según Google Maps Routes API (computeRoutes).
 * Se pide solo `routes.distanceMeters` para pagar el SKU más básico.
 */
export class GoogleRoutesDistanceProvider implements DistanceProvider {
  private readonly logger = new Logger(GoogleRoutesDistanceProvider.name);

  constructor(private readonly apiKey: string | undefined) {
    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_MAPS_API_KEY no está configurada: no se podrán cotizar domicilios.',
      );
    }
  }

  async routeDistanceMeters(origin: LatLng, destination: LatLng) {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'El cálculo de distancia para domicilios no está configurado.',
      );
    }

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
          'x-goog-fieldmask': 'routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: origin } },
          destination: { location: { latLng: destination } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          computeAlternativeRoutes: false,
          units: 'METRIC',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error('Google Routes no respondió', error as Error);
      throw new ServiceUnavailableException(
        'No se pudo calcular la distancia. Inténtalo de nuevo.',
      );
    }

    if (!response.ok) {
      // El cuerpo puede traer detalles de la cuenta: se registra, no se expone.
      this.logger.error(
        `Google Routes respondió ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo calcular la distancia. Inténtalo de nuevo.',
      );
    }

    const data = (await response.json()) as {
      routes?: Array<{ distanceMeters?: number }>;
    };
    const meters = data.routes?.[0]?.distanceMeters;
    if (data.routes?.length && meters === undefined) {
      // Google omite distanceMeters cuando es 0 (mismo punto).
      return 0;
    }
    if (typeof meters !== 'number') {
      throw new BadRequestException(
        'No hay una ruta en auto hasta la dirección indicada.',
      );
    }
    return meters;
  }
}
