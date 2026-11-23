import { describe, expect, it } from 'vitest';
import { firstFreeSlug, slugifyName } from './item-slug.js';

describe('slugifyName', () => {
  it('quita tildes, eñes y signos', () => {
    expect(slugifyName('Hamburguesa Sencilla')).toBe('hamburguesa-sencilla');
    expect(slugifyName('  Piña colada (grande)! ')).toBe('pina-colada-grande');
    expect(slugifyName('Jugo de maracuyá & mora')).toBe(
      'jugo-de-maracuya-mora',
    );
  });

  it('nunca queda vacío', () => {
    expect(slugifyName('¡¡!!')).toBe('producto');
  });
});

describe('firstFreeSlug', () => {
  it('agrega un número al final si ya existe', () => {
    expect(firstFreeSlug('perro', new Set())).toBe('perro');
    expect(firstFreeSlug('perro', new Set(['perro']))).toBe('perro-2');
    expect(
      firstFreeSlug('perro', new Set(['perro', 'perro-2', 'perro-caliente'])),
    ).toBe('perro-3');
  });
});
