import { BusinessFeature } from '../businesses/business-feature.enum.js';

/**
 * Qué es cada elemento del catálogo. Todos comparten nombre, fotos,
 * categoría, variantes (precio y stock) y grupos de opciones; lo propio de
 * cada tipo va en su tabla de detalle.
 */
export enum ItemKind {
  /** Algo que se vende: un plato, una camiseta. */
  Product = 'product',
  /** Algo que se agenda: un corte, un masaje. Detalle en `catalog_service_details`. */
  Service = 'service',
  /** Algo que se cobra cada cierto tiempo: una mensualidad. Detalle en `catalog_plan_details`. */
  Plan = 'plan',
}

/** Cómo se muestra el precio. */
export enum PriceType {
  /** "$15.000". */
  Fixed = 'fixed',
  /** "Desde $15.000": la variante más barata. */
  From = 'from',
  /** "Gratis". */
  Free = 'free',
  /** "A convenir": se cotiza, no se pide en línea. */
  OnRequest = 'on_request',
}

/** Cómo se muestran los productos de una categoría en la tienda. */
export enum CategoryDisplayMode {
  /** Tarjetas en una fila que se desliza de lado. */
  Carousel = 'carousel',
  /** Filas: información a la izquierda, foto a la derecha. */
  List = 'list',
  /** Tarjetas en dos columnas. */
  Grid = 'grid',
}

export enum PlanInterval {
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

/** Funcionalidades que permiten crear cada tipo (basta una activa). */
export const KIND_FEATURES: Record<ItemKind, BusinessFeature[]> = {
  [ItemKind.Product]: [BusinessFeature.Menu, BusinessFeature.Ecommerce],
  [ItemKind.Service]: [BusinessFeature.Bookings],
  [ItemKind.Plan]: [BusinessFeature.Memberships],
};

/** Tipos que el negocio puede usar con sus funcionalidades activas. */
export function enabledKinds(features: readonly BusinessFeature[]): ItemKind[] {
  return Object.values(ItemKind).filter((kind) =>
    KIND_FEATURES[kind].some((f) => features.includes(f)),
  );
}

/** Funcionalidades que dan acceso al catálogo. */
export const CATALOG_FEATURES = [
  ...new Set(Object.values(KIND_FEATURES).flat()),
];
