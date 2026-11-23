export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Calcula la distancia de la ruta entre dos puntos, en metros. */
export interface DistanceProvider {
  routeDistanceMeters(origin: LatLng, destination: LatLng): Promise<number>;
}

export const DISTANCE_PROVIDER = Symbol('DISTANCE_PROVIDER');
