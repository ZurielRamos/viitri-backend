/** Respuestas a "¿Cómo nos conociste?". */
export const REFERRAL_SOURCES = [
  'instagram',
  'tiktok',
  'google',
  'referral',
  'other',
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** Origen de la primera visita, capturado por la web sin preguntar. */
export interface Acquisition {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
  /** Sitio externo desde el que llegó, si lo hubo. */
  referrer?: string;
  /** Primera página del sitio que visitó. */
  landingPath?: string;
  /** ISO 8601. */
  firstSeenAt?: string;
}
