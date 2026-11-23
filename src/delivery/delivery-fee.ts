import { BadRequestException } from '@nestjs/common';

/** Tramo de precio: hasta `upToKm` kilómetros se cobra `fee`. */
export interface DeliveryFeeTier {
  upToKm: number;
  fee: number;
}

/**
 * Busca el primer tramo que cubre la distancia. Los tramos deben venir
 * ordenados por `upToKm` ascendente. Más allá del último tramo no hay
 * cobertura.
 */
export function feeForDistance(
  tiers: DeliveryFeeTier[],
  distanceKm: number,
): number {
  const tier = tiers.find((t) => distanceKm <= t.upToKm);
  if (!tier) {
    const max = tiers.at(-1)?.upToKm ?? 0;
    throw new BadRequestException(
      `La dirección está a ${distanceKm} km y el domicilio cubre hasta ${max} km.`,
    );
  }
  return tier.fee;
}

/** Valida que los tramos sean estrictamente crecientes en km. */
export function findTiersError(tiers: DeliveryFeeTier[]): string | null {
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].upToKm <= tiers[i - 1].upToKm) {
      return 'Los tramos de domicilio deben estar ordenados por km, de menor a mayor y sin repetir.';
    }
  }
  return null;
}
