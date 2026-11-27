import type { ConfigService } from '@nestjs/config';
import type { WhatsappAuthTemplateConfig } from './whatsapp-auth-template.client.js';

/**
 * Configuración de la plantilla de autenticación, o `null` si falta el token
 * o el inbox. En producción la validación del entorno impide arrancar así.
 */
export function whatsappConfig(
  config: ConfigService,
): WhatsappAuthTemplateConfig | null {
  const url = config.get<string>('WHATSAPP_API_URL');
  const token = config.get<string>('WHATSAPP_API_TOKEN');
  const inboxId = config.get<string>('WHATSAPP_INBOX_ID');
  if (!url || !token || !inboxId) return null;
  return {
    url,
    token,
    inboxId,
    templateName:
      config.get<string>('WHATSAPP_TEMPLATE_NAME') || 'autenticacion',
    languageCode: config.get<string>('WHATSAPP_LANGUAGE_CODE') || 'es',
  };
}
