import { describe, expect, it } from 'vitest';
import { BACKGROUND_INFO, THEME_BACKGROUNDS, backgroundFor } from './theme.js';

describe('backgroundFor', () => {
  it('elige según el tipo de negocio', () => {
    expect(backgroundFor('bar', '#f59e0b')).toBe('darkwood');
    expect(backgroundFor('cafe', '#b91c1c')).toBe('oak');
  });
  it('si el color no destaca, cambia a un fondo del otro modo', () => {
    // Amarillo claro sobre madera clara: no se lee.
    expect(BACKGROUND_INFO[backgroundFor('cafe', '#fde047')].mode).toBe('dark');
    // Azul muy oscuro sobre madera oscura: tampoco.
    expect(BACKGROUND_INFO[backgroundFor('bar', '#0b1020')].mode).toBe('light');
  });
  it('cada fondo ofrecido está en la lista que acepta la API', () => {
    for (const id of Object.keys(BACKGROUND_INFO)) {
      expect(THEME_BACKGROUNDS).toContain(id);
    }
  });
});
