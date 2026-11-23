import { addDays, localDate, weekday } from '../common/zoned-time.js';

/** Lo que necesita una promoción para saber si aplica. */
export interface PromotionRule {
  percent: number;
  days: number[];
  startTime: string;
  endTime: string;
  categoryIds: string[];
  itemIds: string[];
  isActive: boolean;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Minutos del día en la zona `tz`. */
function minuteOfDay(now: Date, tz: string): number {
  const [h, m] = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(now)
    .split(':')
    .map(Number);
  return h * 60 + m;
}

/**
 * ¿Está activa ahora? Si termina después de medianoche (22:00–02:00), la
 * madrugada cuenta como parte del día en que empezó.
 */
export function isPromotionLive(
  rule: PromotionRule,
  now: Date,
  tz: string,
): boolean {
  if (!rule.isActive) return false;
  const today = localDate(now, tz);
  const minute = minuteOfDay(now, tz);
  const start = toMinutes(rule.startTime);
  const end = toMinutes(rule.endTime);
  if (end > start) {
    return (
      rule.days.includes(weekday(today)) && minute >= start && minute < end
    );
  }
  return (
    (rule.days.includes(weekday(today)) && minute >= start) ||
    (rule.days.includes(weekday(addDays(today, -1))) && minute < end)
  );
}

/** ¿Aplica a este producto? Sin productos ni categorías, a todo. */
export function promotionCovers(
  rule: Pick<PromotionRule, 'categoryIds' | 'itemIds'>,
  item: { id: string; categoryId: string | null },
): boolean {
  if (!rule.categoryIds.length && !rule.itemIds.length) return true;
  return (
    rule.itemIds.includes(item.id) ||
    (item.categoryId !== null && rule.categoryIds.includes(item.categoryId))
  );
}

/** Precio con descuento, redondeado a la unidad de la moneda (en centavos). */
export function discountCents(unitCents: number, percent: number): number {
  return Math.round((unitCents * (100 - percent)) / 100 / 100) * 100;
}
