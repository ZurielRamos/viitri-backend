import type { OpeningHoursRange } from './profile.types.js';

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Devuelve un mensaje de error si hay tramos inválidos o superpuestos,
 * o `null` si el horario es válido. Los tramos que cruzan la medianoche
 * (close < open) se tratan como parte del día siguiente, y el sábado
 * continúa en el domingo.
 */
export function findOpeningHoursError(
  ranges: OpeningHoursRange[],
): string | null {
  const intervals: Array<[number, number, OpeningHoursRange]> = [];

  for (const range of ranges) {
    const open = toMinutes(range.open);
    const close = toMinutes(range.close);
    if (open === close) {
      return `El tramo ${range.open}-${range.close} del día ${range.day} no puede durar 0 minutos.`;
    }
    const start = range.day * MINUTES_PER_DAY + open;
    const length = close > open ? close - open : MINUTES_PER_DAY - open + close;
    const end = start + length;
    intervals.push([start, end, range]);
    // Si pasa del final de la semana, también ocupa el inicio (domingo).
    if (end > MINUTES_PER_WEEK) {
      intervals.push([start - MINUTES_PER_WEEK, end - MINUTES_PER_WEEK, range]);
    }
  }

  intervals.sort((a, b) => a[0] - b[0]);
  // Recorre en orden de inicio guardando el tramo que termina más tarde.
  let furthest: [number, OpeningHoursRange] | null = null;
  for (const [start, end, current] of intervals) {
    if (furthest && start < furthest[0] && furthest[1] !== current) {
      const prev = furthest[1];
      return `Los tramos ${prev.open}-${prev.close} (día ${prev.day}) y ${current.open}-${current.close} (día ${current.day}) se superponen.`;
    }
    if (!furthest || end > furthest[0]) furthest = [end, current];
  }
  return null;
}

/** Mismas reglas que un día de la semana: sin tramos de 0 minutos ni superpuestos. */
export function findHolidayHoursError(
  ranges: { open: string; close: string }[],
): string | null {
  const error = findOpeningHoursError(ranges.map((r) => ({ day: 0, ...r })));
  if (!error) return null;
  return error.includes('0 minutos')
    ? 'Un horario de festivos no puede durar 0 minutos.'
    : 'Los horarios de festivos se superponen.';
}
