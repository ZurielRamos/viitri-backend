/**
 * Festivos por país, como fechas "YYYY-MM-DD". Por ahora solo Colombia; en
 * los demás países no hay festivos y vale el horario de cada día.
 */

const iso = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Domingo de Pascua (algoritmo de Meeus/Butcher, calendario gregoriano). */
function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Ley Emiliani: si no cae lunes, pasa al lunes siguiente. */
function nextMonday(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  const shift = (8 - date.getUTCDay()) % 7;
  return iso(y, m, d + shift);
}

function colombia(year: number): string[] {
  const { month, day } = easter(year);
  const fromEaster = (days: number) => iso(year, month, day + days);
  const fromEasterMonday = (days: number) => {
    const [y, m, d] = fromEaster(days).split('-').map(Number);
    return nextMonday(y, m, d);
  };
  return [
    // Fijos.
    iso(year, 1, 1),
    iso(year, 5, 1),
    iso(year, 7, 20),
    iso(year, 8, 7),
    iso(year, 12, 8),
    iso(year, 12, 25),
    // Se pasan al lunes.
    nextMonday(year, 1, 6),
    nextMonday(year, 3, 19),
    nextMonday(year, 6, 29),
    nextMonday(year, 8, 15),
    nextMonday(year, 10, 12),
    nextMonday(year, 11, 1),
    nextMonday(year, 11, 11),
    // Semana Santa y los que dependen de la Pascua.
    fromEaster(-3),
    fromEaster(-2),
    fromEasterMonday(39),
    fromEasterMonday(60),
    fromEasterMonday(68),
  ];
}

const cache = new Map<string, Set<string>>();

/** ¿Es festivo en ese país? `country`: ISO 3166-1 alfa-2. */
export function isHoliday(date: string, country: string | null): boolean {
  if (country?.toUpperCase() !== 'CO') return false;
  const year = Number(date.slice(0, 4));
  const key = `CO-${year}`;
  let days = cache.get(key);
  if (!days) {
    days = new Set(colombia(year));
    cache.set(key, days);
  }
  return days.has(date);
}
