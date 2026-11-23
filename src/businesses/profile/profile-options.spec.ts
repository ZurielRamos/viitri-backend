import { describe, expect, it } from 'vitest';
import { specialtiesError } from './profile-options.js';

describe('specialtiesError', () => {
  it('acepta opciones del tipo de negocio', () => {
    expect(
      specialtiesError('restaurant', ['lunch', 'home_cooking']),
    ).toBeNull();
  });

  it('rechaza opciones de otro tipo o inventadas', () => {
    expect(specialtiesError('restaurant', ['haircut'])).toContain(
      'no es una opción',
    );
    expect(specialtiesError('bar', ['lunch'])).toContain('no es una opción');
  });

  it('rechaza más de 3', () => {
    expect(
      specialtiesError('restaurant', ['lunch', 'pizza', 'grill', 'coffee']),
    ).toContain('hasta 3');
  });
});
