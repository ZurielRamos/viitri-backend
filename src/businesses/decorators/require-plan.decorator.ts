import { SetMetadata } from '@nestjs/common';
import type { Plan } from '../plans/plans.js';

export const REQUIRED_PLAN_KEY = 'requiredPlan';

/**
 * Exige que el plan vigente del negocio (con su prueba o su pago) incluya el
 * nivel pedido. Se usa junto con @BusinessAccess(), que es quien lo verifica.
 * El super admin también queda sujeto: así ve lo mismo que el negocio.
 */
export const RequirePlan = (tier: Plan) => SetMetadata(REQUIRED_PLAN_KEY, tier);
