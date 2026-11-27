import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShortLinksService } from '../../links/short-links.service.js';
import { WhatsappTemplateClient } from './whatsapp-template.client.js';
import {
  WHATSAPP_TEMPLATES,
  type WhatsappTemplateId,
} from './whatsapp-templates.js';
import { normalizeWhatsappNumber } from './whatsapp-phone.js';

/** El destino de un botón: una dirección (se crea su enlace corto) o un código ya creado. */
export type ButtonTarget = { url: string; days?: number } | { code: string };

/**
 * Avisos por WhatsApp con plantillas aprobadas. Nunca lanza: si falta la
 * plantilla en el `.env`, el número o el proveedor falla, se registra en el
 * log y quien llamó sigue (un aviso no debe romper un pago ni un pedido).
 */
@Injectable()
export class WhatsappNotificationsService {
  private readonly logger = new Logger(WhatsappNotificationsService.name);
  private cached: { signature: string; client: WhatsappTemplateClient } | null =
    null;

  constructor(
    private readonly config: ConfigService,
    private readonly links: ShortLinksService,
  ) {}

  /** Se lee en cada envío: los cambios desde el panel rigen sin reiniciar. */
  private get client(): WhatsappTemplateClient | null {
    const url = this.config.get<string>('WHATSAPP_TEMPLATE_API_URL');
    const token = this.config.get<string>('WHATSAPP_API_TOKEN');
    const inboxId = this.config.get<string>('WHATSAPP_INBOX_ID');
    if (!url || !token || !inboxId) return null;
    const signature = `${url}|${token}|${inboxId}`;
    if (this.cached?.signature !== signature) {
      this.cached = {
        signature,
        client: new WhatsappTemplateClient({ url, token, inboxId }),
      };
    }
    return this.cached.client;
  }

  private get language(): string {
    return (
      this.config.get<string>('WHATSAPP_TEMPLATES_LANGUAGE_CODE') ||
      this.config.get<string>('WHATSAPP_LANGUAGE_CODE') ||
      'es'
    );
  }

  /** Crea el enlace corto de un botón, para guardarlo y usarlo en varios avisos (seguimiento de un pedido). */
  link(url: string, days?: number): Promise<string> {
    return this.links.create(url, days);
  }

  /**
   * Envía la plantilla. `phone`: como venga (con o sin +57, espacios…); sin
   * número no se envía. Devuelve si salió.
   */
  async send(
    id: WhatsappTemplateId,
    phone: string | null | undefined,
    values: { header?: string[]; body: string[]; buttons?: ButtonTarget[] },
  ): Promise<boolean> {
    const template = WHATSAPP_TEMPLATES[id];
    const name = this.config.get<string>(template.env);
    if (!name || !phone) return false;
    const to = normalizeWhatsappNumber(phone);
    if (!/^\d{8,15}$/.test(to)) return false;
    const header = values.header ?? [];
    const buttons = values.buttons ?? [];
    // Cada variable aprobada necesita exactamente un valor (si no, Meta responde 132000).
    if (
      header.length !== template.header ||
      values.body.length !== template.body ||
      buttons.length !== template.urlButtons
    ) {
      this.logger.error(
        `Plantilla ${name}: variables que no coinciden con su definición.`,
      );
      return false;
    }
    try {
      const urlButtons = await Promise.all(
        buttons.map((b) =>
          'code' in b
            ? Promise.resolve(b.code)
            : this.links.create(b.url, b.days),
        ),
      );
      // Una línea, sin saltos: Meta no acepta saltos de línea ni tabulaciones en las variables.
      const clean = (v: string) =>
        v
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/\s{4,}/g, '   ')
          .trim()
          .slice(0, 300) || '-';
      const payload = {
        header: header.map(clean),
        body: values.body.map(clean),
        urlButtons,
      };
      if (!this.client) {
        // Sin proveedor configurado (desarrollo): se escribe en el log.
        this.logger.log(
          `[WhatsApp ${name} → ${to}] ${JSON.stringify(payload)}`,
        );
        return true;
      }
      await this.client.send(to, name, this.language, payload);
      return true;
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar ${name} a ${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

/** "$19.900", sin decimales. */
export function cop(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "sábado 12 de diciembre". */
export function longDay(date: Date, timeZone: string): string {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  });
}

/** "8:00 p. m.". */
export function shortTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/** El primer nombre, para saludar. */
export const firstName = (name: string | null | undefined) =>
  (name ?? '').trim().split(/\s+/)[0] || 'hola';
