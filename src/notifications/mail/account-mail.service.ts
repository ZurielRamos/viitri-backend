import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mailer } from '@nestjs/mail';
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
}
