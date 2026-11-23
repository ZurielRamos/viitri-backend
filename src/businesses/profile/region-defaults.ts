/**
 * Moneda, zona horaria y país según el indicativo del teléfono, para que el
 * negocio nazca configurado. El propietario puede cambiarlos después.
 */
interface RegionDefaults {
  countryCode: string;
  currency: string;
  timezone: string;
}

// Indicativo → valores. Se busca el prefijo más largo (1809 antes que 1).
const BY_CALLING_CODE: Record<string, RegionDefaults> = {
  '57': { countryCode: 'CO', currency: 'COP', timezone: 'America/Bogota' },
  '52': { countryCode: 'MX', currency: 'MXN', timezone: 'America/Mexico_City' },
  '507': { countryCode: 'PA', currency: 'USD', timezone: 'America/Panama' },
  '51': { countryCode: 'PE', currency: 'PEN', timezone: 'America/Lima' },
  '56': { countryCode: 'CL', currency: 'CLP', timezone: 'America/Santiago' },
  '54': {
    countryCode: 'AR',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
  },
  '593': { countryCode: 'EC', currency: 'USD', timezone: 'America/Guayaquil' },
  '58': { countryCode: 'VE', currency: 'USD', timezone: 'America/Caracas' },
  '506': { countryCode: 'CR', currency: 'CRC', timezone: 'America/Costa_Rica' },
  '502': { countryCode: 'GT', currency: 'GTQ', timezone: 'America/Guatemala' },
  '503': {
    countryCode: 'SV',
    currency: 'USD',
    timezone: 'America/El_Salvador',
  },
  '504': {
    countryCode: 'HN',
    currency: 'HNL',
    timezone: 'America/Tegucigalpa',
  },
  '505': { countryCode: 'NI', currency: 'NIO', timezone: 'America/Managua' },
  '591': { countryCode: 'BO', currency: 'BOB', timezone: 'America/La_Paz' },
  '595': { countryCode: 'PY', currency: 'PYG', timezone: 'America/Asuncion' },
  '598': { countryCode: 'UY', currency: 'UYU', timezone: 'America/Montevideo' },
  '1809': {
    countryCode: 'DO',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
  },
  '1829': {
    countryCode: 'DO',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
  },
  '1849': {
    countryCode: 'DO',
    currency: 'DOP',
    timezone: 'America/Santo_Domingo',
  },
  '34': { countryCode: 'ES', currency: 'EUR', timezone: 'Europe/Madrid' },
  '1': { countryCode: 'US', currency: 'USD', timezone: 'America/New_York' },
};

/** `phone`: solo dígitos con indicativo, como se guarda en `users.phone`. */
export function regionDefaultsForPhone(
  phone: string | null | undefined,
): RegionDefaults | null {
  if (!phone) return null;
  for (let length = 4; length >= 1; length--) {
    const match = BY_CALLING_CODE[phone.slice(0, length)];
    if (match) return match;
  }
  return null;
}
