import type { OpeningHoursRange } from '../businesses/profile/profile.types.js';

/**
 * Fechas en la zona horaria de un negocio, sin librerías: las fechas son
 * "YYYY-MM-DD" en su zona y los instantes, `Date` (UTC).
 */

const DAY_MINUTES = 24 * 60;

/** Diferencia (ms) entre la hora local de `tz` y UTC en ese instante. */
function tzOffset(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** El instante de "fecha a los `minutes` minutos del día" en la zona `tz`. */
export function zonedInstant(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let instant = wall - tzOffset(wall, tz);
  // Si el cambio de horario cae en medio, se corrige con el offset real.
  const second = tzOffset(instant, tz);
  if (wall - second !== instant) instant = wall - second;
  return new Date(instant);
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona `tz`. */
export function localDate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Tramos abiertos de una fecha, en minutos del día. Un tramo que cruza la
 * medianoche (22:00–02:00) llega hasta el final del día y su resto abre el
 * día siguiente desde las 00:00.
 */
export function windowsFor(
  date: string,
  hours: OpeningHoursRange[],
): [number, number][] {
  const day = weekday(date);
  const previous = (day + 6) % 7;
  const windows: [number, number][] = [];
  for (const range of hours) {
    const open = toMinutes(range.open);
    const close = toMinutes(range.close);
    if (range.day === day) {
      windows.push([open, close > open ? close : DAY_MINUTES]);
    }
    if (range.day === previous && close < open && close > 0) {
      windows.push([0, close]);
    }
  }
  return windows.sort((a, b) => a[0] - b[0]);
}
