import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mailer } from '@nestjs/mail';
import {
  PaymentReceiptMail,
  type PaymentReceiptData,
} from './payment-receipt.mail.js';
import {
  PlanReminderMail,
  type PlanReminderData,
} from './plan-reminder.mail.js';
import {
  PasswordResetMail,
  type PasswordResetData,
} from './password-reset.mail.js';
import { WelcomeMail } from './welcome.mail.js';

@Injectable()
export class AccountMailService {
  private readonly logger = new Logger(AccountMailService.name);

  constructor(
    private readonly mailer: Mailer,
    private readonly config: ConfigService,
  ) {}

  /**
   * Envía la bienvenida. Nunca lanza: un fallo del servidor de correo no debe
   * romper un registro que ya se guardó.
   */
  async sendWelcome(user: {
    name: string;
    email: string | null;
  }): Promise<void> {
    // Los perfiles del equipo (PIN) no tienen correo.
    if (!user.email) return;
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');
    try {
      await this.mailer.send(WelcomeMail, {
        to: { name: user.name, address: user.email },
        data: {
          name: user.name,
          panelUrl: new URL('/panel', appUrl).toString(),
          logoUrl: new URL('/brand/viitri-logo-blue.png', appUrl).toString(),
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la bienvenida a ${user.email}`,
        error as Error,
      );
    }
  }

  /** Logo de viitri para los correos, servido por la web. */
  logoUrl(): string {
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');
    return new URL('/brand/viitri-logo-blue.png', appUrl).toString();
  }

  /** Aviso de vencimiento del plan. Nunca lanza: devuelve si se envió. */
  async sendPlanReminder(
    to: { name: string; email: string },
    data: PlanReminderData,
  ): Promise<boolean> {
    try {
      await this.mailer.send(PlanReminderMail, {
        to: { name: to.name, address: to.email },
        data,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el aviso de vencimiento a ${to.email}`,
        error as Error,
      );
      return false;
    }
  }

  /** Comprobante de pago. Nunca lanza. */
  async sendPaymentReceipt(
    to: { name: string; email: string },
    data: PaymentReceiptData,
  ): Promise<void> {
    try {
      await this.mailer.send(PaymentReceiptMail, {
        to: { name: to.name, address: to.email },
        data,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el comprobante a ${to.email}`,
        error as Error,
      );
    }
  }

  /** Correo de recuperación de contraseña. Nunca lanza. */
  async sendPasswordReset(
    to: { name: string; email: string },
    data: Omit<PasswordResetData, 'name' | 'logoUrl'>,
  ): Promise<void> {
    try {
      await this.mailer.send(PasswordResetMail, {
        to: { name: to.name, address: to.email },
        data: { ...data, name: to.name, logoUrl: this.logoUrl() },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la recuperación de contraseña a ${to.email}`,
        error as Error,
      );
    }
  }
}
