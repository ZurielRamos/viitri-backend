import { WhatsappDeliveryError } from './whatsapp-auth-template.client.js';

const REQUEST_TIMEOUT_MS = 15_000;

export interface WhatsappTemplateClientConfig {
  /** Endpoint del proveedor (Strategee) que envía plantillas con variables y botones. */
  url: string;
  token: string;
  inboxId: string;
}

/** Valores de una plantilla aprobada: uno por cada variable, en orden. */
export interface TemplateValues {
  /** Variables del encabezado de texto ({{1}}…), si tiene. */
  header?: string[];
  /** Variables del cuerpo ({{1}}, {{2}}…). */
  body: string[];
  /** Sufijo de cada botón de URL dinámica, en el orden de los botones. */
  urlButtons?: string[];
}

/**
 * El mensaje en el formato de la API de WhatsApp Cloud (`components`), con el
 * inbox y la plantilla como los usa Strategee. Es el único lugar a ajustar si
 * el proveedor espera otra forma.
 */
export function templatePayload(
  config: WhatsappTemplateClientConfig,
  to: string,
  templateName: string,
  languageCode: string,
  values: TemplateValues,
) {
  const text = (value: string) => ({ type: 'text', text: value });
  const components: Record<string, unknown>[] = [];
  if (values.header?.length)
    components.push({ type: 'header', parameters: values.header.map(text) });
  components.push({ type: 'body', parameters: values.body.map(text) });
  (values.urlButtons ?? []).forEach((suffix, index) =>
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(index),
      parameters: [text(suffix)],
    }),
  );
  return {
    inboxId: config.inboxId,
    to,
    templateName,
    languageCode,
    components,
  };
}

/** Envía plantillas de Utilidad (avisos) por el proveedor de WhatsApp. */
export class WhatsappTemplateClient {
  constructor(
    private readonly config: WhatsappTemplateClientConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** `to`: solo dígitos con indicativo de país. */
  async send(
    to: string,
    templateName: string,
    languageCode: string,
    values: TemplateValues,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchFn(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': this.config.token,
        },
        body: JSON.stringify(
          templatePayload(this.config, to, templateName, languageCode, values),
        ),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'error',
      });
    } catch (error) {
      throw new WhatsappDeliveryError(
        'No se pudo contactar al proveedor de WhatsApp.',
        undefined,
        (error instanceof Error ? error.message : String(error)).slice(0, 500),
      );
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new WhatsappDeliveryError(
        `El proveedor de WhatsApp respondió ${response.status}.`,
        response.status,
        body.slice(0, 500),
      );
    }
  }
}
