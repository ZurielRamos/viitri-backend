import { describe, expect, it } from 'vitest';
import { GeoService } from './geo.service.js';

describe('GeoService', () => {
  const geo = new GeoService();

  it('tiene los 33 departamentos de Colombia y sus municipios', () => {
    const regions = geo.regions('CO');
    expect(regions).toHaveLength(33);
    expect(regions.reduce((n, r) => n + r.cities.length, 0)).toBeGreaterThan(
      1100,
    );
  });

  it('usa el nombre común y guarda el oficial', () => {
    const cali = geo.cities('co', '76').find((c) => c.code === '76001');
    expect(cali).toMatchObject({ name: 'Cali', official: 'Santiago de Cali' });
  });

  it('otros países no tienen datos', () => {
    expect(geo.supports('MX')).toBe(false);
    expect(() => geo.regions('MX')).toThrow();
  });
});
