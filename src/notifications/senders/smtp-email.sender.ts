import { Injectable } from '@nestjs/common';
import { Mailer } from '@nestjs/mail';
import { NotificationChannel } from '../notification-channel.enum.js';
import type {
  NotificationSender,
  OutgoingMessage,
} from '../notification-sender.js';

/** Canal email: envía por el transporte de `MailModule` (SMTP en producción). */
@Injectable()
export class MailNotificationSender implements NotificationSender {
  readonly channel = NotificationChannel.Email;

  constructor(private readonly mailer: Mailer) {}

  async send(message: OutgoingMessage): Promise<void> {
    await this.mailer.send({
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }
}
