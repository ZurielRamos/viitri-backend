import { describe, expect, it } from 'vitest';
import { canTakeOrders, effectivePlan, planStatus } from './plans.js';

const now = new Date('2026-05-10T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('planes: prueba gratis y plan vigente', () => {
  it('Avanzado rige durante la prueba, sigue 3 días de gracia y luego vuelve a Básico', () => {
    const state = {
      plan: 'advanced' as const,
      trialEndsAt: days(3),
      paidUntil: null,
    };
    expect(effectivePlan(state, now)).toBe('advanced');
    expect(planStatus(state, now)).toMatchObject({
      trialDaysLeft: 3,
      graceDaysLeft: null,
      expired: false,
    });
    // Al día siguiente de vencer: en gracia, todavía funciona.
    const inGrace = days(4);
    expect(effectivePlan(state, inGrace)).toBe('advanced');
    expect(planStatus(state, inGrace)).toMatchObject({
      trialDaysLeft: null,
      graceDaysLeft: 2,
      expired: false,
    });
    // Pasada la gracia: Básico.
    const later = days(7);
    expect(effectivePlan(state, later)).toBe('basic');
    expect(planStatus(state, later)).toMatchObject({
      graceDaysLeft: null,
      expired: true,
    });
  });

  it('pagado, rige aunque la prueba ya haya vencido', () => {
    const state = {
      plan: 'pro' as const,
      trialEndsAt: days(-20),
      paidUntil: days(10),
    };
    expect(effectivePlan(state, now)).toBe('pro');
    expect(planStatus(state, now)).toMatchObject({
      trialDaysLeft: null,
      paidDaysLeft: 10,
    });
  });

  it('en Básico el menú no recibe pedidos; en Avanzado vigente, sí', () => {
    const features = ['menu'];
    expect(
      canTakeOrders(
        { plan: 'basic', trialEndsAt: null, paidUntil: null, features },
        now,
      ),
    ).toBe(false);
    expect(
      canTakeOrders(
        { plan: 'advanced', trialEndsAt: days(1), paidUntil: null, features },
        now,
      ),
    ).toBe(true);
    expect(
      canTakeOrders(
        {
          plan: 'advanced',
          trialEndsAt: days(1),
          paidUntil: null,
          features: [],
        },
        now,
      ),
    ).toBe(false);
  });
});
