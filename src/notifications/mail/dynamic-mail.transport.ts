import {
  MailTransport,
  type MailMessage,
  type MailTransportResult,
  type MailTransportSendOptions,
} from '@nestjs/mail';
import type { ConfigService } from '@nestjs/config';
import { mailTransport, type SmtpSettings } from './mail.config.js';

/**
 * Lee el SMTP en cada envío: si cambia desde el panel, el siguiente correo
 * ya sale con los datos nuevos, sin reiniciar. El transporte anterior se
 * cierra cuando terminan sus envíos.
 */
export class DynamicMailTransport extends MailTransport {
  private current: { signature: string; transport: MailTransport } | null =
    null;

  constructor(private readonly config: ConfigService) {
    super();
    // Al arrancar, un SMTP_PORT inválido detiene la app, como antes.
    this.resolve();
  }

  private settings(): SmtpSettings {
    return {
      host: this.config.get<string>('SMTP_HOST') || undefined,
      port: Number(this.config.get<string>('SMTP_PORT') || 587),
      user: this.config.get<string>('SMTP_USER') || undefined,
      pass: this.config.get<string>('SMTP_PASS') || undefined,
    };
  }

  private resolve(): MailTransport {
    const settings = this.settings();
    const signature = JSON.stringify(settings);
    if (this.current?.signature !== signature) {
      const previous = this.current?.transport;
      this.current = { signature, transport: mailTransport(settings) };
      void previous?.close?.();
    }
    return this.current.transport;
  }

  send(
    message: MailMessage,
    options: MailTransportSendOptions,
  ): Promise<MailTransportResult> {
    return this.resolve().send(message, options);
  }

  async close(): Promise<void> {
    await this.current?.transport.close?.();
  }
}
