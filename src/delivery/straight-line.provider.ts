import { Logger } from '@nestjs/common';
import type { DistanceProvider, LatLng } from './distance-provider.js';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Solo para desarrollo y pruebas: distancia en línea recta (haversine).
 * Es menor que la ruta real, así que no debe usarse para cobrar.
 */
export class StraightLineDistanceProvider implements DistanceProvider {
  constructor() {
    new Logger(StraightLineDistanceProvider.name).warn(
      'DISTANCE_PROVIDER=straight_line: las distancias son en línea recta, no por ruta. No usar en producción.',
    );
  }

  routeDistanceMeters(a: LatLng, b: LatLng): Promise<number> {
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return Promise.resolve(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
  }
}
