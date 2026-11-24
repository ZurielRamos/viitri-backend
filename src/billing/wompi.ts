import { createHash, timingSafeEqual } from 'node:crypto';

/** Llaves y secretos de Wompi (Dashboard → Desarrolladores). */
export interface WompiConfig {
  publicKey: string;
  integritySecret: string;
  eventsSecret: string;
  /** `test` (Sandbox) o `prod`; los eventos de otro ambiente se ignoran. */
  environment: 'test' | 'prod';
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/**
 * Firma de integridad del pago: SHA256 de referencia + monto en centavos +
 * moneda (+ expiración, si se envía) + secreto de integridad. Se calcula en
 * el servidor: el secreto nunca llega al navegador.
 */
export function integritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  secret: string,
  expirationTime?: string,
): string {
  return sha256(
    `${reference}${amountInCents}${currency}${expirationTime ?? ''}${secret}`,
  );
}

/** Datos del pagador para prellenar el checkout de Wompi. */
export interface WompiCustomer {
  email: string;
  fullName: string;
  legalIdType: string;
  legalId: string;
}

/** URL del Web Checkout de Wompi con el pago ya armado y firmado. */
export function checkoutUrl(
  config: WompiConfig,
  payment: {
    reference: string;
    amountInCents: number;
    currency: string;
    redirectUrl: string;
  },
  customer: WompiCustomer,
): string {
  const url = new URL('https://checkout.wompi.co/p/');
  const params: Record<string, string> = {
    'public-key': config.publicKey,
    currency: payment.currency,
    'amount-in-cents': String(payment.amountInCents),
    reference: payment.reference,
    'signature:integrity': integritySignature(
      payment.reference,
      payment.amountInCents,
      payment.currency,
      config.integritySecret,
    ),
    'redirect-url': payment.redirectUrl,
    'customer-data:email': customer.email,
    'customer-data:full-name': customer.fullName,
    'customer-data:legal-id-type': customer.legalIdType,
    'customer-data:legal-id': customer.legalId,
  };
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url.toString();
}

/** Lo que trae un evento de Wompi (POST a la URL de eventos). */
export interface WompiEvent {
  event: string;
  data: Record<string, unknown>;
  environment: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp: number;
}

/** El valor de `transaction.id` dentro de `data`. */
function valueAt(data: Record<string, unknown>, path: string): string {
  let current: unknown = data;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === 'string') return current;
  if (typeof current === 'number' || typeof current === 'boolean')
    return String(current);
  return '';
}

/**
 * El evento es auténtico: SHA256 de los valores de `signature.properties`
 * (en su orden, tomados de `data`) + `timestamp` + secreto de eventos, igual
 * al checksum. Las propiedades se leen del evento, no se asumen.
 */
export function isAuthenticEvent(
  event: WompiEvent,
  secret: string,
  headerChecksum?: string,
): boolean {
  const properties = event.signature?.properties;
  const checksum = event.signature?.checksum ?? headerChecksum;
  if (!properties?.length || !checksum || typeof event.timestamp !== 'number')
    return false;
  const expected = sha256(
    `${properties.map((p) => valueAt(event.data, p)).join('')}${event.timestamp}${secret}`,
  );
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(checksum.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
