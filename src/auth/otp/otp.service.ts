import { randomInt, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TTL_STORE, type TtlStore } from '../../common/ttl-store/ttl-store.js';
import {
  WhatsappAuthTemplateClient,
  WhatsappDeliveryError,
} from '../../notifications/whatsapp/whatsapp-auth-template.client.js';
import {
  maskPhone,
  normalizeWhatsappNumber,
} from '../../notifications/whatsapp/whatsapp-phone.js';

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_COOLDOWN_SECONDS = 30;
/** Con 4 dígitos los intentos son pocos y hay tope por hora, para que adivinar no sea viable. */
export const OTP_LENGTH = 4;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_HOURLY_LIMIT = 5;
const ONE_HOUR_SECONDS = 60 * 60;

/** Cliente de WhatsApp, o `null` si no hay credenciales (solo desarrollo). */
export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');

export interface OtpTarget {
  /** Para qué se pide el código, por ejemplo `auth`. */
  purpose: string;
  /** Ámbito del código, por ejemplo `platform` o el id de un negocio. */
  scope: string;
  phone: string;
}

interface OtpRecord {
  code: string;
  attempts: number;
  payload: unknown;
}

export type OtpVerification =
  | { status: 'ok'; payload: unknown }
  | { status: 'not_found' | 'mismatch' | 'too_many_attempts' };

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(TTL_STORE) private readonly store: TtlStore,
    @Inject(WHATSAPP_CLIENT)
    private readonly whatsapp: WhatsappAuthTemplateClient | null,
    private readonly config: ConfigService,
  ) {}

  /** Genera un código, lo guarda y lo envía por WhatsApp. */
  async send(target: OtpTarget, payload: unknown = null): Promise<void> {
    const phone = normalizeWhatsappNumber(target.phone);
    const codeKey = this.codeKey({ ...target, phone });
    const cooldownKey = this.cooldownKey({ ...target, phone });

    if (
      !(await this.store.setIfAbsent(cooldownKey, true, OTP_COOLDOWN_SECONDS))
    ) {
      throw new BadRequestException(
        'Espera unos segundos antes de solicitar otro código.',
      );
    }

    await this.consumeHourlyQuota({ ...target, phone });

    const code = String(randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
    const record: OtpRecord = { code, attempts: 0, payload };
    await this.store.set(codeKey, record, OTP_TTL_SECONDS);

    try {
      await this.deliver(phone, code);
    } catch (error) {
      // Un código que no llegó no sirve: se libera para que pueda reintentar.
      await this.store.delete(codeKey);
      await this.store.delete(cooldownKey);
      this.logger.error(
        `No se pudo enviar el código a ${maskPhone(phone)}: ${describe(error)}`,
      );
      throw new BadRequestException(
        'No se pudo enviar el código por WhatsApp. Verifica el número e intenta de nuevo.',
      );
    }
  }

  /** Comprueba el código. Un código correcto se consume: sirve una sola vez. */
  verify(target: OtpTarget, code: string): Promise<OtpVerification> {
    const key = this.codeKey({
      ...target,
      phone: normalizeWhatsappNumber(target.phone),
    });
    return this.store.mutate<OtpRecord, OtpVerification>(key, (record) => {
      if (!record) return { result: { status: 'not_found' } };
      if (record.attempts >= OTP_MAX_ATTEMPTS) {
        return { value: null, result: { status: 'too_many_attempts' } };
      }
      if (!safeEqual(record.code, code)) {
        return {
          value: { ...record, attempts: record.attempts + 1 },
          result: { status: 'mismatch' },
        };
      }
      return { value: null, result: { status: 'ok', payload: record.payload } };
    });
  }

  /** Cuenta un envío para el número. Rechaza con 429 al pasar el tope de la hora. */
  private async consumeHourlyQuota(target: OtpTarget): Promise<void> {
    const key = `otp:hourly:${target.purpose}:${target.scope}:${target.phone}`;
    if (await this.store.setIfAbsent(key, { count: 1 }, ONE_HOUR_SECONDS))
      return;

    const allowed = await this.store.mutate<{ count: number }, boolean>(
      key,
      (current) => {
        // Venció entre las dos llamadas: este envío abre una hora nueva.
        if (!current) return { result: true };
        if (current.count >= OTP_HOURLY_LIMIT) return { result: false };
        return { value: { count: current.count + 1 }, result: true };
      },
    );
    if (!allowed) {
      throw new HttpException(
        'Solicitaste demasiados códigos. Intenta de nuevo en una hora.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async deliver(phone: string, code: string): Promise<void> {
    if (this.whatsapp) {
      await this.whatsapp.sendAuthCode(phone, code);
      return;
    }
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new WhatsappDeliveryError('WhatsApp no está configurado.');
    }
    this.logger.warn(
      `WHATSAPP_API_TOKEN o WHATSAPP_INBOX_ID sin configurar: el código para ${maskPhone(phone)} es ${code}`,
    );
  }

  private codeKey({ purpose, scope, phone }: OtpTarget): string {
    return `otp:${purpose}:${scope}:${phone}`;
  }

  private cooldownKey({ purpose, scope, phone }: OtpTarget): string {
    return `otp:cooldown:${purpose}:${scope}:${phone}`;
  }
}

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function describe(error: unknown): string {
  if (error instanceof WhatsappDeliveryError) {
    return `${error.message} ${error.status ?? ''} ${error.detail ?? ''}`.trim();
  }
  return error instanceof Error ? error.message : String(error);
}
