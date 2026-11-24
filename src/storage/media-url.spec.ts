import {
  mediaUrlListTransformer,
  mediaUrlTransformer,
  toMediaKey,
  toMediaUrl,
} from './media-url.js';

const KEY = 'businesses/b1/logo-abc.webp';

describe('media-url', () => {
  const original = process.env.API_PUBLIC_URL;
  afterEach(() => {
    process.env.API_PUBLIC_URL = original;
  });

  it('guarda como ruta relativa las URLs de esta API y las de una API local', () => {
    process.env.API_PUBLIC_URL = 'https://api.viitri.com';
    expect(toMediaKey(`https://api.viitri.com/media/${KEY}`)).toBe(KEY);
    expect(toMediaKey(`http://localhost:3000/media/${KEY}`)).toBe(KEY);
    expect(toMediaKey(`http://127.0.0.1:3100/media/${KEY}`)).toBe(KEY);
  });

  it('deja igual los enlaces externos, aunque tengan la misma forma', () => {
    process.env.API_PUBLIC_URL = 'https://api.viitri.com';
    for (const url of [
      'https://cdn.example.com/foto.jpg',
      `https://cdn.example.com/media/${KEY}`,
      'https://api.viitri.com/media/otros/x.webp',
      'no es una url',
    ]) {
      expect(toMediaKey(url)).toBe(url);
    }
  });

  it('arma la URL con el API_PUBLIC_URL actual, sin barra doble', () => {
    process.env.API_PUBLIC_URL = 'https://api.viitri.com/';
    expect(toMediaUrl(KEY)).toBe(`https://api.viitri.com/media/${KEY}`);
    process.env.API_PUBLIC_URL = 'http://localhost:3000';
    expect(toMediaUrl(KEY)).toBe(`http://localhost:3000/media/${KEY}`);
  });

  it('lee igual los valores viejos guardados como URL completa', () => {
    const old = `https://api.viitri.com/media/${KEY}`;
    expect(toMediaUrl(old)).toBe(old);
  });

  it('los transformadores respetan null y listas', () => {
    process.env.API_PUBLIC_URL = 'https://api.viitri.com';
    expect(mediaUrlTransformer.to(null)).toBeNull();
    expect(mediaUrlTransformer.from(null)).toBeNull();
    expect(
      mediaUrlListTransformer.to([
        `http://localhost:3000/media/${KEY}`,
        'https://cdn.example.com/a.jpg',
      ]),
    ).toEqual([KEY, 'https://cdn.example.com/a.jpg']);
    expect(mediaUrlListTransformer.from([KEY])).toEqual([
      `https://api.viitri.com/media/${KEY}`,
    ]);
  });
});
