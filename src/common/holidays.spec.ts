import { describe, expect, it } from 'vitest';
import { isHoliday } from './holidays.js';

describe('festivos de Colombia', () => {
  // Calendario oficial 2026.
  const official2026 = [
    '2026-01-01',
    '2026-01-12',
    '2026-03-23',
    '2026-04-02',
    '2026-04-03',
    '2026-05-01',
    '2026-05-18',
    '2026-06-08',
    '2026-06-15',
    '2026-06-29',
    '2026-07-20',
    '2026-08-07',
    '2026-08-17',
    '2026-10-12',
    '2026-11-02',
    '2026-11-16',
    '2026-12-08',
    '2026-12-25',
  ];
  it.each(official2026)('%s es festivo', (date) => {
    expect(isHoliday(date, 'CO')).toBe(true);
  });
  it('un día normal no es festivo', () => {
    expect(isHoliday('2026-11-23', 'CO')).toBe(false);
  });
  it('en otros países no hay festivos', () => {
    expect(isHoliday('2026-01-01', 'PA')).toBe(false);
    expect(isHoliday('2026-01-01', null)).toBe(false);
  });
});
