import { describe, expect, it } from 'vitest';
import { BusinessFeature as F } from '../business-feature.enum.js';
import { BUSINESS_TYPES } from '../business-type.js';
import {
  BUSINESS_TYPE_PRESETS,
  FEATURE_CATALOG,
  featureDefinition,
  featureSetError,
  isBusinessTypeAvailable,
} from './feature-catalog.js';

describe('Catálogo de funcionalidades', () => {
  it('define cada funcionalidad del enum una sola vez', () => {
    const ids = FEATURE_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.values(F).sort());
  });

  it('cada tipo de negocio tiene plantilla y solo activa funcionalidades disponibles', () => {
    for (const type of BUSINESS_TYPES) {
      const preset = BUSINESS_TYPE_PRESETS[type];
      // Todo negocio nace en Básico: lo que activa la plantilla debe caber ahí.
      expect(featureSetError(preset.enabled, 'basic')).toBeNull();
      expect(preset.recommended.some((f) => preset.enabled.includes(f))).toBe(
        false,
      );
    }
  });

  it('rechaza las que están en "pronto" y las retiradas', () => {
    expect(featureSetError([F.Menu, F.Loyalty], 'pro')).toContain('pronto');
    expect(featureSetError([F.Menu, F.Bookings], 'pro')).toContain('ya no');
  });

  it('las de fidelizar necesitan una de vender o agendar', () => {
    expect(featureDefinition(F.Loyalty).requiresAnyOf).toContain(F.Menu);
  });

  it('todos los tipos de negocio son de comida y se pueden crear', () => {
    expect(isBusinessTypeAvailable('restaurant')).toBe(true);
    expect(isBusinessTypeAvailable('fast_food')).toBe(true);
  });

  it('rechaza funcionalidades de un plan superior', () => {
    expect(featureSetError([F.Menu], 'basic')).toBeNull();
    expect(featureDefinition(F.Promotions).tier).toBe('advanced');
  });
});
