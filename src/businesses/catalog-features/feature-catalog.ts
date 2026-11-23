import { BusinessFeature as F } from '../business-feature.enum.js';
import { BUSINESS_TYPES, type BusinessType } from '../business-type.js';
import {
  planDefinition,
  planIncludes,
  type Plan,
  PLAN_FEATURE_LIMITS,
  PLANS as PLAN_ORDER,
} from '../plans/plans.js';

/**
 * Catálogo único de funcionalidades. Cada una es un módulo reutilizable y
 * pertenece a un plan (Básico, Avanzado o Pro), que es también su grupo.
 */
/**
 * `retired`: ya no se ofrece (el producto se enfocó en restaurantes y bares).
 * Su código y sus datos se conservan, pero no se muestra ni se puede activar.
 */
export type FeatureStatus = 'available' | 'coming_soon' | 'retired';

export interface FeatureDefinition {
  id: F;
  /** Plan desde el que está incluida. */
  tier: Plan;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Necesita al menos una de estas activa (por ejemplo, fidelizar requiere ventas). */
  requiresAnyOf?: F[];
}

/** Funcionalidades que generan ventas o reservas; fidelizar se apoya en ellas. */
const SALES: F[] = [F.Menu, F.TableReservations, F.Events];

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    id: F.Menu,
    tier: 'basic',
    name: 'Menú digital',
    description:
      'Tu carta con fotos y precios, con tu enlace y su código QR. Los pedidos (en mesa, a domicilio o para recoger) están desde el plan Avanzado.',
    status: 'available',
  },
  {
    id: F.Ecommerce,
    tier: 'basic',
    name: 'Tienda en línea',
    description: 'Productos con variantes, inventario y envíos.',
    status: 'retired',
  },
  {
    id: F.Quotes,
    tier: 'advanced',
    name: 'Cotizaciones',
    description: 'Pedidos grandes, catering o encargos a medida.',
    status: 'retired',
  },
  {
    id: F.Bookings,
    tier: 'basic',
    name: 'Citas',
    description: 'Servicios, profesionales y horarios disponibles.',
    status: 'retired',
  },
  {
    id: F.TableReservations,
    tier: 'pro',
    name: 'Reserva de mesas',
    description: 'Tus clientes reservan mesa: día, hora y cuántas personas.',
    status: 'available',
  },
  {
    id: F.Events,
    tier: 'pro',
    name: 'Eventos',
    description: 'Noches temáticas, música en vivo o partidos, con cupos.',
    status: 'coming_soon',
  },
  {
    id: F.Waitlist,
    tier: 'advanced',
    name: 'Fila virtual',
    description: 'Aviso por WhatsApp cuando llega el turno.',
    status: 'coming_soon',
  },
  {
    id: F.Promotions,
    tier: 'advanced',
    name: 'Promociones y cupones',
    description: 'Descuentos, combos y happy hour.',
    status: 'retired',
    requiresAnyOf: SALES,
  },
  {
    id: F.Loyalty,
    tier: 'pro',
    name: 'Puntos y sellos',
    description: '"Compra 10 y la siguiente es gratis".',
    status: 'coming_soon',
    requiresAnyOf: SALES,
  },
  {
    id: F.GiftCards,
    tier: 'pro',
    name: 'Tarjetas de regalo',
    description: 'Venta y canje de saldo.',
    status: 'retired',
    requiresAnyOf: SALES,
  },
  {
    id: F.Memberships,
    tier: 'pro',
    name: 'Membresías',
    description: 'Planes mensuales, por ejemplo 8 clases al mes.',
    status: 'retired',
    requiresAnyOf: SALES,
  },
  {
    id: F.Reviews,
    tier: 'advanced',
    name: 'Reseñas',
    description: 'Calificaciones de tus clientes después de cada pedido.',
    status: 'coming_soon',
    requiresAnyOf: SALES,
  },
];

/** Tipos de negocio que ya se pueden crear. Los demás se muestran como "Próximamente". */
export const AVAILABLE_BUSINESS_TYPES: BusinessType[] = [...BUSINESS_TYPES];

export function isBusinessTypeAvailable(type: BusinessType): boolean {
  return AVAILABLE_BUSINESS_TYPES.includes(type);
}

export interface BusinessTypePreset {
  /** Se activan al crear el negocio. Solo funcionalidades disponibles. */
  enabled: F[];
  /** Se ofrecen apagadas, en "También te pueden servir". */
  recommended: F[];
}

export const BUSINESS_TYPE_PRESETS: Record<BusinessType, BusinessTypePreset> = {
  restaurant: {
    enabled: [F.Menu],
    recommended: [F.TableReservations, F.Loyalty, F.Reviews],
  },
  fast_food: {
    enabled: [F.Menu],
    recommended: [F.Loyalty, F.Reviews],
  },
  bar: {
    enabled: [F.Menu],
    recommended: [F.TableReservations, F.Events, F.Waitlist],
  },
  cafe: {
    enabled: [F.Menu],
    recommended: [F.Loyalty, F.Reviews, F.TableReservations],
  },
  bakery: {
    enabled: [F.Menu],
    recommended: [F.Loyalty, F.Reviews],
  },
  ice_cream: {
    enabled: [F.Menu],
    recommended: [F.Loyalty, F.Reviews],
  },
};

FEATURE_CATALOG.sort(
  (a, b) => PLAN_ORDER.indexOf(a.tier) - PLAN_ORDER.indexOf(b.tier),
);

const BY_ID = new Map(FEATURE_CATALOG.map((f) => [f.id, f]));

export function featureDefinition(id: F): FeatureDefinition {
  const definition = BY_ID.get(id);
  if (!definition)
    throw new Error(`Funcionalidad sin definir en el catálogo: ${id}`);
  return definition;
}

/**
 * Motivo por el que un conjunto de funcionalidades no es válido, o `null`.
 * Se usa al crear el negocio, al activar o desactivar y al cambiar de plan.
 */
export function featureSetError(
  features: F[],
  plan: Plan,
  /**
   * Las que se revisan por estado y plan (por defecto, todas). Al activar o
   * desactivar solo se revisa la nueva: una que ya estaba no impide cambiar
   * otra aunque el plan se haya vencido.
   */
  checked: F[] = features,
): string | null {
  for (const id of features) {
    const definition = featureDefinition(id);
    if (!checked.includes(id)) {
      if (
        definition.requiresAnyOf &&
        !definition.requiresAnyOf.some((r) => features.includes(r))
      ) {
        return `"${definition.name}" necesita una funcionalidad para vender o agendar.`;
      }
      continue;
    }
    if (definition.status === 'retired') {
      return `"${definition.name}" ya no está disponible.`;
    }
    if (definition.status !== 'available') {
      return `"${definition.name}" estará disponible pronto.`;
    }
    if (PLAN_FEATURE_LIMITS && !planIncludes(plan, definition.tier)) {
      return `"${definition.name}" está en el plan ${planDefinition(definition.tier).name}.`;
    }
    if (
      definition.requiresAnyOf &&
      !definition.requiresAnyOf.some((r) => features.includes(r))
    ) {
      return `"${definition.name}" necesita una funcionalidad para vender o agendar.`;
    }
  }
  return null;
}
