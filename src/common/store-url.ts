import type { ConfigService } from '@nestjs/config';

/** `https://{slug}.viitri.com/ruta`, a partir de APP_URL (el dominio principal de la web). */
export function storeUrl(
  config: ConfigService,
  slug: string,
  path = '/',
): string {
  const url = new URL(config.get<string>('APP_URL', 'http://localhost:3001'));
  url.hostname = `${slug}.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}
