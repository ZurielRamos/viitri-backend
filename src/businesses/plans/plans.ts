/**
 * Planes de un negocio. Cada negocio paga el suyo. Cada plan incluye las
 * funcionalidades de su nivel y de los anteriores, y un máximo de personas.
 */
export const PLANS = ['basic', 'advanced', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

/**
 * Precios y cobro. Por ahora viven aquí: no hay pasarela de pago todavía.
 * Precios provisionales, en pesos colombianos enteros (sin centavos).
 */
export const CURRENCY = 'COP';
/** Se cobra por mes, por negocio, sin permanencia. */
export const BILLING_PERIOD = 'monthly';

export interface PlanDefinition {
  id: Plan;
  name: string;
  /** Precio mensual por negocio, en CURRENCY. */
  monthlyPrice: number;
  /** Personas con cuenta propia, contando al propietario y las invitaciones pendientes. */
  maxMembers: number;
  /** Colaboradores que entran con PIN (el dueño no cuenta). */
  maxTeamProfiles: number;
  /** Días de prueba gratis al elegirlo. Básico no tiene: es el plan gratis. */
  trialDays: number;
  /** Lo que incluye, en frases cortas para comparar los planes. */
  highlights: string[];
}

/** Días de prueba gratis de Avanzado y Pro. */
export const TRIAL_DAYS = 14;

/**
 * Días de gracia al vencer la prueba o el pago: el plan sigue funcionando
 * mientras se le avisa que pague, y luego pasa a Básico.
 */
export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'basic',
    name: 'Básico',
    monthlyPrice: 0,
    maxMembers: 1,
    maxTeamProfiles: 0,
    trialDays: 0,
    highlights: [
      'Tu menú digital con fotos y precios',
      'Tu enlace y el código QR para compartir',
      'Solo para mostrar: sin carrito ni pedidos',
    ],
  },
  {
    id: 'advanced',
    name: 'Avanzado',
    monthlyPrice: 19_900,
    maxMembers: 5,
    maxTeamProfiles: 4,
    trialDays: TRIAL_DAYS,
    highlights: [
      'Tu menú digital con fotos y precios',
      'Tu enlace y el código QR para compartir',
      'Pedidos desde la app: Para la mesa, recoger o domicilio (El pedido te llega directamente al WhatsApp)',
      'Resumen de cuentas y ventas del día',
      'Hasta 4 colaboradores con PIN',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29_900,
    maxMembers: 15,
    maxTeamProfiles: 9,
    trialDays: TRIAL_DAYS,
    highlights: [
      'Tu menú digital con fotos y precios',
      'Tu enlace y el código QR para compartir',
      'Pedidos desde la app: Para la mesa, recoger o domicilio (El pedido te llega directamente al WhatsApp)',
      'Reserva de mesas',
      'Resumen y reportes en Excel de ventas, gastos, costos, inventario',
      'Diferentes usuarios para cada colaborador (Administrador, vendedor, domiciliario, cajero)',
      'Hasta 9 colaboradores con PIN',
    ],
  },
];

export const DEFAULT_PLAN: Plan = 'basic';

/** Cada funcionalidad exige su plan (`tier`). */
export const PLAN_FEATURE_LIMITS = true;

/** Los colaboradores con PIN cuentan en `maxTeamProfiles`. */
export const TEAM_PROFILE_LIMITS = true;

/**
 * Pedidos (carrito, checkout, mesas, cocina, cuentas, clientes y ventas):
 * desde Avanzado. En Básico el menú es solo para mostrar.
 */
export const ORDERS_TIER: Plan = 'advanced';

/** Lo que define el plan vigente de un negocio. */
export interface PlanState {
  plan: Plan;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

/**
 * El plan que rige hoy. Avanzado y Pro rigen mientras dure la prueba o el
 * pago; al vencer ambos, el negocio funciona como Básico (sin borrar nada).
 */
export function effectivePlan(state: PlanState, now = new Date()): Plan {
  if (state.plan === 'basic') return 'basic';
  const until = coveredUntil(state);
  return until && until.getTime() + GRACE_DAYS * DAY_MS > now.getTime()
    ? state.plan
    : 'basic';
}

/** Hasta cuándo está cubierto el plan (prueba o pago), sin contar la gracia. */
export function coveredUntil(state: PlanState): Date | null {
  const until = Math.max(
    state.trialEndsAt?.getTime() ?? 0,
    state.paidUntil?.getTime() ?? 0,
  );
  return until ? new Date(until) : null;
}

/** Para mostrar: el plan vigente, la prueba, el vencimiento y la gracia. */
export function planStatus(state: PlanState, now = new Date()) {
  const current = effectivePlan(state, now);
  const until = coveredUntil(state);
  const paid = Boolean(
    state.paidUntil && until && state.paidUntil.getTime() >= until.getTime(),
  );
  const daysTo = (date: Date) =>
    Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
  const covered = until !== null && until.getTime() > now.getTime();
  return {
    effectivePlan: current,
    /** Días de prueba que quedan; `null` si no está en prueba. */
    trialDaysLeft:
      !paid && current !== 'basic' && covered && until
        ? Math.max(1, daysTo(until))
        : null,
    /** Días de plan pagado que quedan; `null` si no está pagado. */
    paidDaysLeft: paid && covered && until ? Math.max(1, daysTo(until)) : null,
    /** Venció, pero sigue funcionando unos días: hay que pagar ya. */
    graceDaysLeft:
      current !== 'basic' && !covered && until
        ? Math.max(1, daysTo(new Date(until.getTime() + GRACE_DAYS * DAY_MS)))
        : null,
    /** Eligió un plan de pago y se le venció (prueba o pago) sin pagar. */
    expired: state.plan !== 'basic' && current === 'basic',
  };
}

/** El negocio recibe pedidos: tiene el menú y su plan vigente los incluye. */
export function canTakeOrders(
  business: PlanState & { features: string[] },
  now = new Date(),
): boolean {
  return (
    business.features.includes('menu') &&
    planIncludes(effectivePlan(business, now), ORDERS_TIER)
  );
}

/**
 * Por ahora cada cuenta tiene un solo negocio (el código admite varios, por si
 * luego se ofrece). Solo el super admin puede crear más, para dar soporte.
 */
export const FREE_BUSINESS_USED_MESSAGE =
  'Cada cuenta tiene un solo negocio, y tú ya creaste el tuyo.';

export function planDefinition(plan: Plan): PlanDefinition {
  return PLAN_DEFINITIONS.find((p) => p.id === plan) ?? PLAN_DEFINITIONS[0];
}

/**
 * Lo que paga un negocio al mes. El primer negocio del usuario no paga
 * mientras siga en Básico; si sube de plan, paga el plan nuevo.
 */
export function monthlyCharge(business: {
  plan: Plan;
  freeBasic: boolean;
}): number {
  if (business.plan === 'basic' && business.freeBasic) return 0;
  return planDefinition(business.plan).monthlyPrice;
}

/** El plan del negocio incluye lo del nivel pedido o uno inferior. */
export function planIncludes(plan: Plan, tier: Plan): boolean {
  return PLANS.indexOf(plan) >= PLANS.indexOf(tier);
}
