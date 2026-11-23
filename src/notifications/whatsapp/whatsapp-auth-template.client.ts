const MAX_DETAIL_LENGTH = 500;
const REQUEST_TIMEOUT_MS = 15_000;

export interface WhatsappAuthTemplateConfig {
  /** URL completa del endpoint, no una URL base. */
  url: string;
  token: string;
  inboxId: string;
  templateName: string;
  languageCode: string;
}

/** Fallo al entregar el mensaje: de red, de timeout o una respuesta no 2xx. */
export class WhatsappDeliveryError extends Error {
  constructor(
    message: string,
    /** Estado HTTP del proveedor. Ausente si no hubo respuesta. */
    readonly status?: number,
    /** Hasta 500 caracteres del body de la respuesta o del error de red. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'WhatsappDeliveryError';
  }
}

/** Envía un código OTP con la plantilla de autenticación de Strategee. */
export class WhatsappAuthTemplateClient {
  constructor(
    private readonly config: WhatsappAuthTemplateConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** `to`: solo dígitos con indicativo de país. */
  async sendAuthCode(to: string, code: string): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchFn(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': this.config.token,
        },
        body: JSON.stringify({
          inboxId: this.config.inboxId,
          to,
          templateName: this.config.templateName,
          languageCode: this.config.languageCode,
          code,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: 'error',
      });
    } catch (error) {
      throw new WhatsappDeliveryError(
        'No se pudo contactar al proveedor de WhatsApp.',
        undefined,
        truncate(error instanceof Error ? error.message : String(error)),
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new WhatsappDeliveryError(
        `El proveedor de WhatsApp respondió ${response.status}.`,
        response.status,
        truncate(body),
      );
    }
  }
}

function truncate(text: string): string {
  return text.slice(0, MAX_DETAIL_LENGTH);
}
