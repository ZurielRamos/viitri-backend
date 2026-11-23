import { Logger } from '@nestjs/common';
import type { NotificationChannel } from '../notification-channel.enum.js';
import type {
  NotificationSender,
  OutgoingMessage,
} from '../notification-sender.js';

/**
 * Sender provisional: escribe el mensaje en el log en vez de enviarlo.
 * Se reemplaza por el proveedor real de cada canal cuando se defina.
 */
export class LogNotificationSender implements NotificationSender {
  private readonly logger = new Logger(LogNotificationSender.name);

  constructor(readonly channel: NotificationChannel) {}

  send(message: OutgoingMessage): Promise<void> {
    this.logger.log(
      `[${this.channel}] to=${message.to} subject="${message.subject}"\n${message.body}`,
    );
    return Promise.resolve();
  }
}
