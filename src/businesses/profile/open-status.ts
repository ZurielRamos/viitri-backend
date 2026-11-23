import { isHoliday } from '../../common/holidays.js';
import {
  addDays,
  localDate,
  weekday,
  windowsFor,
  zonedInstant,
} from '../../common/zoned-time.js';
import type { HolidayHoursRange, OpeningHoursRange } from './profile.types.js';

/**
 * Tramos de un día: en festivo, el horario de festivos (vacío: cerrado);
 * si no, el de ese día de la semana.
 */
export function hoursOn(
  date: string,
  weekly: OpeningHoursRange[],
  holidayHours: HolidayHoursRange[],
  country: string | null,
): OpeningHoursRange[] {
  const day = weekday(date);
  return isHoliday(date, country)
    ? holidayHours.map((r) => ({ day, ...r }))
    : weekly.filter((r) => r.day === day);
}

export interface OpenStatus {
  /** Sin horario configurado no se sabe: se considera abierto. */
  hasHours: boolean;
  isOpen: boolean;
  /** Abierto: cuándo cierra. */
  closesAt: string | null;
  /** Cerrado: cuándo vuelve a abrir (en la próxima semana). */
  opensAt: string | null;
}

/** ¿Está abierto ahora? Con la zona horaria, los festivos y los horarios que pasan de medianoche. */
export function openStatus(
  profile: {
    openingHours: OpeningHoursRange[];
    holidayHours?: HolidayHoursRange[] | null;
    timezone: string;
    countryCode: string | null;
  },
  now: Date = new Date(),
): OpenStatus {
  if (!profile.openingHours.length) {
    return { hasHours: false, isOpen: true, closesAt: null, opensAt: null };
  }
  const tz = profile.timezone || 'UTC';
  const today = localDate(now, tz);
  const on = (date: string) =>
    hoursOn(
      date,
      profile.openingHours,
      profile.holidayHours ?? [],
      profile.countryCode,
    );
  // Tramos de ayer a dentro de una semana, como instantes, unidos si se tocan.
  const intervals: [number, number][] = [];
  for (let i = -1; i <= 7; i++) {
    const date = addDays(today, i);
    for (const [open, close] of windowsFor(date, [
      ...on(addDays(date, -1)),
      ...on(date),
    ])) {
      intervals.push([
        zonedInstant(date, open, tz).getTime(),
        zonedInstant(date, close, tz).getTime(),
      ]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  const t = now.getTime();
  const current = merged.find(([start, end]) => start <= t && t < end);
  if (current) {
    return {
      hasHours: true,
      isOpen: true,
      closesAt: new Date(current[1]).toISOString(),
      opensAt: null,
    };
  }
  const next = merged.find(([start]) => start > t);
  return {
    hasHours: true,
    isOpen: false,
    closesAt: null,
    opensAt: next ? new Date(next[0]).toISOString() : null,
  };
}
