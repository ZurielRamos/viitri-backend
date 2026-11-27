import { GRACE_DAYS, PLAN_DEFINITIONS } from '../businesses/plans/plans.js';

/**
 * Estado del plan en SQL, igual que `planStatus` de plans.ts, para filtrar y
 * contar en la base sin cargar todos los negocios. `b` es el alias de la
 * tabla `businesses`.
 */
const until = 'GREATEST(b.trial_ends_at, b.paid_until)';
const grace = `interval '${GRACE_DAYS} days'`;

export const PLAN_STATUS_SQL = {
  basic: `b.plan = 'basic'`,
  paid: `b.plan <> 'basic' AND b.paid_until > now() AND b.paid_until >= COALESCE(b.trial_ends_at, b.paid_until)`,
  trial: `b.plan <> 'basic' AND b.trial_ends_at > now() AND (b.paid_until IS NULL OR b.paid_until < b.trial_ends_at)`,
  grace: `b.plan <> 'basic' AND ${until} <= now() AND ${until} + ${grace} > now()`,
  expired: `b.plan <> 'basic' AND (${until} IS NULL OR ${until} + ${grace} <= now())`,
} as const;

export type PlanStatusFilter = keyof typeof PLAN_STATUS_SQL;
export const PLAN_STATUS_FILTERS = Object.keys(
  PLAN_STATUS_SQL,
) as PlanStatusFilter[];

/** Vence (prueba o pago) en los próximos `days` días. */
export const expiresWithinSql = (days: number) =>
  `b.plan <> 'basic' AND ${until} > now() AND ${until} <= now() + interval '${days} days'`;

/** Precio mensual del plan, para sumar lo que entra cada mes. */
export const PLAN_PRICE_SQL = `CASE b.plan ${PLAN_DEFINITIONS.map(
  (p) => `WHEN '${p.id}' THEN ${p.monthlyPrice}`,
).join(' ')} ELSE 0 END`;
