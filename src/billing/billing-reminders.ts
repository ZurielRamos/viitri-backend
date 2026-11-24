import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service.js';

/** Todos los días a las 9 a. m. de Colombia: avisos de planes por vencer. */
@Injectable()
export class BillingReminders {
  private readonly logger = new Logger(BillingReminders.name);

  constructor(private readonly billing: BillingService) {}

  @Cron('0 9 * * *', { timeZone: 'America/Bogota' })
  async run() {
    try {
      const sent = await this.billing.sendReminders();
      if (sent) this.logger.log(`Avisos de vencimiento enviados: ${sent}`);
    } catch (error) {
      this.logger.error(
        'Falló el envío de avisos de vencimiento',
        error as Error,
      );
    }
  }
}
