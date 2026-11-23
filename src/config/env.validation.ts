/**
 * Valida las variables de entorno al arrancar para fallar rápido
 * si falta algo crítico.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  const secret = config.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    errors.push(
      'JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.',
    );
  }

  const acceptUrl = config.INVITATION_ACCEPT_URL;
  if (typeof acceptUrl !== 'string' || !URL.canParse(acceptUrl)) {
    errors.push(
      'INVITATION_ACCEPT_URL es obligatorio y debe ser una URL válida.',
    );
  }

  const smtpHost = config.SMTP_HOST;
  if (typeof smtpHost === 'string' && smtpHost !== '') {
    const port = Number(config.SMTP_PORT ?? 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push('SMTP_PORT debe ser un puerto válido (1 a 65535).');
    }
    if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASS)) {
      errors.push('SMTP_USER y SMTP_PASS deben definirse juntos.');
    }
  } else if (config.NODE_ENV === 'production') {
    errors.push('SMTP_HOST es obligatorio en producción.');
  }
  const whatsappUrl = config.WHATSAPP_API_URL;
  if (
    whatsappUrl !== undefined &&
    whatsappUrl !== '' &&
    (typeof whatsappUrl !== 'string' ||
      !/^https?:\/\//.test(whatsappUrl) ||
      !URL.canParse(whatsappUrl))
  ) {
    errors.push('WHATSAPP_API_URL debe ser una URL http(s) válida.');
  }
  if (config.NODE_ENV === 'production') {
    for (const name of [
      'WHATSAPP_API_URL',
      'WHATSAPP_API_TOKEN',
      'WHATSAPP_INBOX_ID',
    ]) {
      if (!config[name]) errors.push(`${name} es obligatorio en producción.`);
    }
  }
  if (config.NODE_ENV === 'production' && config.DB_SYNCHRONIZE === 'true') {
    errors.push('DB_SYNCHRONIZE no puede estar activo en producción.');
  }
  if (config.STORAGE_BUCKET) {
    for (const name of ['STORAGE_HMAC_ACCESS_KEY', 'STORAGE_HMAC_SECRET']) {
      if (!config[name])
        errors.push(`${name} es obligatorio con STORAGE_BUCKET.`);
    }
  } else if (config.NODE_ENV === 'production') {
    // En producción el disco local se pierde al reemplazar el contenedor.
    errors.push('STORAGE_BUCKET es obligatorio en producción.');
  }
  // Las URLs de las imágenes apuntan a la API: en producción, su URL pública.
  if (config.NODE_ENV === 'production' && !config.API_PUBLIC_URL) {
    errors.push('API_PUBLIC_URL es obligatorio en producción.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return config;
}
