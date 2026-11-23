import { describe, expect, it } from 'vitest';
import { openStatus } from './open-status.js';

const profile = {
  // Lunes a sábado de 8:00 a 18:00; viernes hasta las 2:00 del sábado.
  openingHours: [
    ...[1, 2, 3, 4, 6].map((day) => ({ day, open: '08:00', close: '18:00' })),
    { day: 5, open: '08:00', close: '02:00' },
  ],
  holidayHours: [],
  timezone: 'America/Bogota',
  countryCode: 'CO',
};
// Bogotá es UTC-5.
const at = (iso: string) => new Date(`${iso}-05:00`);

describe('openStatus', () => {
  it('abierto dentro del horario, con la hora de cierre', () => {
    const status = openStatus(profile, at('2026-11-24T10:00:00'));
    expect(status.isOpen).toBe(true);
    expect(status.closesAt).toBe(at('2026-11-24T18:00:00').toISOString());
  });
  it('cerrado de noche, con la próxima apertura', () => {
    const status = openStatus(profile, at('2026-11-24T20:00:00'));
    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toBe(at('2026-11-25T08:00:00').toISOString());
  });
  it('el horario que pasa de medianoche sigue abierto el sábado temprano', () => {
    const status = openStatus(profile, at('2026-11-28T01:00:00'));
    expect(status.isOpen).toBe(true);
    expect(status.closesAt).toBe(at('2026-11-28T02:00:00').toISOString());
  });
  it('en festivo sin horario de festivos, cerrado', () => {
    // 2026-11-16 es lunes festivo.
    expect(openStatus(profile, at('2026-11-16T10:00:00')).isOpen).toBe(false);
  });
  it('sin horario, se considera abierto', () => {
    const status = openStatus(
      { ...profile, openingHours: [] },
      at('2026-11-24T03:00:00'),
    );
    expect(status).toMatchObject({ hasHours: false, isOpen: true });
  });
});
