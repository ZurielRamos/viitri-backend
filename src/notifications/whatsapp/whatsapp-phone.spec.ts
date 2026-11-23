import { describe, expect, it } from 'vitest';
import {
  maskPhone,
  normalizeWhatsappNumber,
  toInternationalNumber,
} from './whatsapp-phone.js';

describe('normalizeWhatsappNumber', () => {
  it('antepone 57 a un móvil colombiano de 10 dígitos', () => {
    expect(normalizeWhatsappNumber('3001234567')).toBe('573001234567');
  });

  it('deja igual un número que ya trae indicativo', () => {
    expect(normalizeWhatsappNumber('573001234567')).toBe('573001234567');
  });

  it('quita todo lo que no sea dígito', () => {
    expect(normalizeWhatsappNumber('+57 (300) 123-4567')).toBe('573001234567');
    expect(normalizeWhatsappNumber('300 123 4567')).toBe('573001234567');
  });

  it('no toca números de 10 dígitos que no empiezan por 3', () => {
    expect(normalizeWhatsappNumber('2125551234')).toBe('2125551234');
  });

  it('usa los dígitos tal cual en cualquier otro caso', () => {
    expect(normalizeWhatsappNumber('+1 415 555 2671')).toBe('14155552671');
    expect(normalizeWhatsappNumber('50760001234')).toBe('50760001234');
  });
});

describe('números con +', () => {
  it('no aplica la regla de Colombia si el número trae +', () => {
    // Estonia: +372 y un móvil de 7 dígitos son 10 dígitos que empiezan por 3.
    expect(normalizeWhatsappNumber('+372 5123 456')).toBe('3725123456');
    // Hungría: +36 y un fijo de 8 dígitos.
    expect(normalizeWhatsappNumber('+36 1234 5678')).toBe('3612345678');
  });

  it('toInternationalNumber aplica la regla una sola vez', () => {
    expect(toInternationalNumber('3001234567')).toBe('+573001234567');
    expect(toInternationalNumber('+3725123456')).toBe('+3725123456');
    for (const input of ['3001234567', '+3725123456', '+57 300 123 4567']) {
      const once = toInternationalNumber(input);
      expect(toInternationalNumber(once)).toBe(once);
      expect(normalizeWhatsappNumber(once)).toBe(once.slice(1));
    }
  });
});

describe('maskPhone', () => {
  it('oculta los dígitos centrales', () => {
    expect(maskPhone('573001234567')).toBe('57******4567');
  });
});
