import type { ValueTransformer } from 'typeorm';
import { PUBLIC_MEDIA_PREFIX } from './storage.config.js';

/**
 * Las imágenes propias se guardan en la base como ruta relativa
 * (`businesses/<id>/logo-….webp`) y la URL completa se arma al leer, con el
 * `API_PUBLIC_URL` de quien responde. Así una imagen subida desde local
 * funciona en producción y al revés, porque ambos usan el mismo bucket.
 *
 * Los servicios, los DTOs y la web siguen viendo URLs completas: la
 * conversión ocurre solo al entrar y salir de la base.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function apiPublicUrl(): string {
  return (process.env.API_PUBLIC_URL || 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}

export function mediaBaseUrl(): string {
  return `${apiPublicUrl()}/media/`;
}

/**
 * Es nuestra si apunta a /media/businesses/ de esta API, o de una API local
 * (así quedaron las imágenes subidas en desarrollo). Cualquier otro dominio
 * se trata como enlace externo, aunque tenga la misma forma.
 */
function ownMediaKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const mediaPath = `/media/${PUBLIC_MEDIA_PREFIX}`;
  if (!parsed.pathname.startsWith(mediaPath)) return null;
  const ours =
    LOOPBACK_HOSTS.has(parsed.hostname) ||
    parsed.origin === new URL(apiPublicUrl()).origin;
  return ours
    ? decodeURIComponent(parsed.pathname.slice('/media/'.length))
    : null;
}

/** URL completa → ruta relativa si es nuestra; si no, la deja igual. */
export function toMediaKey(url: string): string {
  return ownMediaKey(url) ?? url;
}

/** Ruta relativa → URL completa. Los enlaces externos quedan igual. */
export function toMediaUrl(value: string): string {
  return value.startsWith(PUBLIC_MEDIA_PREFIX)
    ? `${mediaBaseUrl()}${value}`
    : value;
}

/** Para columnas de una sola imagen (`varchar`, admite null). */
export const mediaUrlTransformer: ValueTransformer = {
  to: (value: string | null | undefined) =>
    typeof value === 'string' ? toMediaKey(value) : value,
  from: (value: string | null) =>
    typeof value === 'string' ? toMediaUrl(value) : value,
};

/** Para columnas `jsonb` con una lista de imágenes. */
export const mediaUrlListTransformer: ValueTransformer = {
  to: (value: string[] | null | undefined) =>
    Array.isArray(value) ? value.map(toMediaKey) : value,
  from: (value: string[] | null) =>
    Array.isArray(value) ? value.map(toMediaUrl) : value,
};
