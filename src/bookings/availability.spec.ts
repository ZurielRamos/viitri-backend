import { describe, expect, it } from 'vitest';
import {
  addDays,
  localDate,
  slotsFor,
  weekday,
  windowsFor,
  zonedInstant,
  type SlotQuery,
} from './availability.js';

const BOGOTA = 'America/Bogota';
// 2026-11-23 es lunes.
const MONDAY = '2026-11-23';

const base = (over: Partial<SlotQuery> = {}): SlotQuery => ({
  date: MONDAY,
  timezone: BOGOTA,
  hours: [{ day: 1, open: '09:00', close: '11:00' }],
  durationMinutes: 30,
  bufferMinutes: 0,
  intervalMinutes: 30,
  earliest: new Date(0),
  resources: [''],
  busy: new Map(),
  ...over,
});

const times = (query: SlotQuery) =>
  slotsFor(query).map((s) =>
    s.startsAt.toLocaleTimeString('es-CO', {
      timeZone: BOGOTA,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }),
  );

describe('fechas en la zona del negocio', () => {
  it('convierte la hora local a UTC (Bogotá es UTC-5)', () => {
    expect(zonedInstant(MONDAY, 9 * 60, BOGOTA).toISOString()).toBe(
      '2026-11-23T14:00:00.000Z',
    );
  });
  it('da la fecha local de un instante', () => {
    expect(localDate(new Date('2026-11-24T03:00:00Z'), BOGOTA)).toBe(MONDAY);
  });
  it('suma días y da el día de la semana', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(weekday(MONDAY)).toBe(1);
  });
});

describe('windowsFor', () => {
  it('parte los tramos que cruzan la medianoche', () => {
    const hours = [{ day: 0, open: '22:00', close: '02:00' }];
    expect(windowsFor('2026-11-22', hours)).toEqual([[22 * 60, 24 * 60]]);
    expect(windowsFor(MONDAY, hours)).toEqual([[0, 120]]);
  });
});

describe('slotsFor', () => {
  it('ofrece cada intervalo en que la cita cabe en el horario', () => {
    expect(times(base())).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });
  it('no ofrece citas que terminan después del cierre', () => {
    expect(times(base({ durationMinutes: 45 }))).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });
  it('respeta la anticipación mínima', () => {
    const earliest = zonedInstant(MONDAY, 10 * 60, BOGOTA);
    expect(times(base({ earliest }))).toEqual(['10:00', '10:30']);
  });
  it('salta lo ocupado, contando el tiempo libre de la cita', () => {
    const start = zonedInstant(MONDAY, 10 * 60, BOGOTA).getTime();
    const busy = new Map([
      ['', [[start, start + 30 * 60_000]] as [number, number][]],
    ]);
    expect(times(base({ busy }))).toEqual(['09:00', '09:30', '10:30']);
    // Con 15 min de tiempo libre, 9:30 ya choca con la de las 10:00.
    expect(times(base({ busy, bufferMinutes: 15 }))).toEqual([
      '09:00',
      '10:30',
    ]);
  });
  it('con varios profesionales, el horario sigue libre si alguno lo está', () => {
    const start = zonedInstant(MONDAY, 9 * 60, BOGOTA).getTime();
    const busy = new Map([
      ['ana', [[start, start + 30 * 60_000]] as [number, number][]],
    ]);
    const [first] = slotsFor(base({ resources: ['ana', 'luis'], busy }));
    expect(first.resources).toEqual(['luis']);
  });
  it('sin horario ese día, no hay citas', () => {
    expect(times(base({ date: addDays(MONDAY, 1) }))).toEqual([]);
  });
  it('con capacidad, acepta varias a la vez hasta llenarse', () => {
    const start = zonedInstant(MONDAY, 9 * 60, BOGOTA).getTime();
    const one: [number, number] = [start, start + 90 * 60_000];
    const query = (n: number) =>
      base({
        durationMinutes: 90,
        capacity: 2,
        fitMinutes: 60,
        busy: new Map([['', Array.from({ length: n }, () => one)]]),
      });
    // Con una reserva a las 9:00 aún cabe otra; con dos, no.
    expect(times(query(1))).toContain('09:00');
    expect(times(query(2))).not.toContain('09:00');
    // La última se toma hasta una hora antes del cierre (11:00).
    expect(times(query(0)).at(-1)).toBe('10:00');
  });
});
