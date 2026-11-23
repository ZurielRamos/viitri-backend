import type { OpeningHoursRange } from '../businesses/profile/profile.types.js';
import { windowsFor, zonedInstant } from '../common/zoned-time.js';

export {
  addDays,
  localDate,
  weekday,
  windowsFor,
  zonedInstant,
} from '../common/zoned-time.js';

/**
 * Cálculo de horarios libres para citas. Funciones puras: las fechas del
 * negocio son "YYYY-MM-DD" en su zona horaria y los instantes, `Date` (UTC).
 */

const MINUTE = 60_000;

/** Quién atiende: un profesional (su id) o, sin profesionales, el negocio (''). */
export type ResourceId = string;

export interface SlotQuery {
  date: string;
  timezone: string;
  hours: OpeningHoursRange[];
  durationMinutes: number;
  /** Tiempo libre después de la cita: también bloquea. */
  bufferMinutes: number;
  /** Cada cuánto empieza un horario: 15, 30… */
  intervalMinutes: number;
  /** Nada antes de este instante (ahora más la anticipación mínima). */
  earliest: Date;
  resources: ResourceId[];
  /** Citas a la vez por cada quien (reservas de mesa: varias). Por defecto, 1. */
  capacity?: number;
  /** Minutos que deben caber antes del cierre. Por defecto, la duración. */
  fitMinutes?: number;
  /** Lo ocupado por cada quien: [inicio, fin) en ms, con su tiempo libre. */
  busy: Map<ResourceId, [number, number][]>;
}

export interface Slot {
  startsAt: Date;
  /** Quiénes están libres a esa hora. */
  resources: ResourceId[];
}

/**
 * Horarios libres de una fecha. La cita debe terminar dentro del tramo
 * abierto (su tiempo libre puede pasarse) y no cruzarse con otra cita del
 * mismo profesional, contando el tiempo libre de ambas.
 */
export function slotsFor(query: SlotQuery): Slot[] {
  const slots: Slot[] = [];
  const blocked = (query.durationMinutes + query.bufferMinutes) * MINUTE;
  for (const [open, close] of windowsFor(query.date, query.hours)) {
    for (
      let minute = open;
      minute + (query.fitMinutes ?? query.durationMinutes) <= close;
      minute += query.intervalMinutes
    ) {
      const startsAt = zonedInstant(query.date, minute, query.timezone);
      const start = startsAt.getTime();
      if (start < query.earliest.getTime()) continue;
      const end = start + blocked;
      const capacity = query.capacity ?? 1;
      const free = query.resources.filter(
        (r) =>
          (query.busy.get(r) ?? []).filter(([s, e]) => s < end && start < e)
            .length < capacity,
      );
      if (free.length) slots.push({ startsAt, resources: free });
    }
  }
  return slots;
}
