import { describe, expect, it } from 'vitest';
import {
  discountCents,
  isPromotionLive,
  promotionCovers,
} from './promotion-schedule.js';

const TZ = 'America/Bogota';
const at = (iso: string) => new Date(`${iso}-05:00`);
// Lunes a jueves de 17:00 a 19:00.
const happy = {
  percent: 20,
  days: [1, 2, 3, 4],
  startTime: '17:00',
  endTime: '19:00',
  categoryIds: [],
  itemIds: [],
  isActive: true,
};

describe('isPromotionLive', () => {
  it('activa en su día y su hora', () => {
    expect(isPromotionLive(happy, at('2026-11-23T18:00:00'), TZ)).toBe(true);
  });
  it('inactiva fuera de la hora o del día', () => {
    expect(isPromotionLive(happy, at('2026-11-23T19:00:00'), TZ)).toBe(false);
    expect(isPromotionLive(happy, at('2026-11-27T18:00:00'), TZ)).toBe(false);
  });
  it('si pasa de medianoche, la madrugada es del día en que empezó', () => {
    const night = { ...happy, days: [5], startTime: '22:00', endTime: '02:00' };
    expect(isPromotionLive(night, at('2026-11-28T01:00:00'), TZ)).toBe(true);
    expect(isPromotionLive(night, at('2026-11-29T01:00:00'), TZ)).toBe(false);
  });
  it('pausada, nunca', () => {
    expect(
      isPromotionLive(
        { ...happy, isActive: false },
        at('2026-11-23T18:00:00'),
        TZ,
      ),
    ).toBe(false);
  });
});

describe('promotionCovers y discountCents', () => {
  it('sin productos ni categorías aplica a todo; si no, a los elegidos', () => {
    expect(promotionCovers(happy, { id: 'a', categoryId: null })).toBe(true);
    const drinks = { categoryIds: ['c1'], itemIds: ['x'] };
    expect(promotionCovers(drinks, { id: 'a', categoryId: 'c1' })).toBe(true);
    expect(promotionCovers(drinks, { id: 'x', categoryId: null })).toBe(true);
    expect(promotionCovers(drinks, { id: 'a', categoryId: 'c2' })).toBe(false);
  });
  it('redondea al peso', () => {
    expect(discountCents(1_250_000, 20)).toBe(1_000_000);
    expect(discountCents(1_299_900, 15)).toBe(1_104_900);
  });
});
