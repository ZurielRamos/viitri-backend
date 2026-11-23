import { describe, expect, it } from 'vitest';
import { regionDefaultsForPhone } from './region-defaults.js';

describe('regionDefaultsForPhone', () => {
  it('usa el prefijo más largo', () => {
    expect(regionDefaultsForPhone('18095551234')?.countryCode).toBe('DO');
    expect(regionDefaultsForPhone('14155552671')?.countryCode).toBe('US');
    expect(regionDefaultsForPhone('573001234567')).toEqual({
      countryCode: 'CO',
      currency: 'COP',
      timezone: 'America/Bogota',
    });
  });

  it('sin teléfono o país desconocido, no propone nada', () => {
    expect(regionDefaultsForPhone(null)).toBeNull();
    expect(regionDefaultsForPhone('99912345678')).toBeNull();
  });
});
