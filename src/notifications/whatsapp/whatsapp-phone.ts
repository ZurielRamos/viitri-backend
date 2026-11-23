/**
 * Número en el formato que espera la API de WhatsApp: solo dígitos con
 * indicativo de país. Un número escrito con `+` ya trae el indicativo y se
 * usa tal cual. Sin `+`, un móvil colombiano de 10 dígitos que empieza por 3
 * recibe el prefijo 57; cualquier otro número se asume con indicativo.
 */
export function normalizeWhatsappNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+')) return digits;
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
}

/** Igual que `normalizeWhatsappNumber`, con `+`. Volver a normalizarlo no lo cambia. */
export function toInternationalNumber(value: string): string {
  return `+${normalizeWhatsappNumber(value)}`;
}

/** Oculta los dígitos centrales para los logs: 573001234567 → 57******4567. */
export function maskPhone(phone: string): string {
  return phone.length <= 6
    ? '***'
    : `${phone.slice(0, 2)}${'*'.repeat(phone.length - 6)}${phone.slice(-4)}`;
}
