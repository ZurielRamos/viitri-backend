import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel } from './notification-channel.enum.js';
import {
  NOTIFICATION_SENDERS,
  type NotificationSender,
  type OutgoingMessage,
} from './notification-sender.js';

@Injectable()
export class NotificationsService {
  private readonly senders: Map<NotificationChannel, NotificationSender>;

  constructor(@Inject(NOTIFICATION_SENDERS) senders: NotificationSender[]) {
    this.senders = new Map(senders.map((s) => [s.channel, s]));
  }

  async send(
    channel: NotificationChannel,
    message: OutgoingMessage,
  ): Promise<void> {
    const sender = this.senders.get(channel);
    if (!sender) {
      throw new Error(`No hay proveedor configurado para el canal ${channel}.`);
    }
    await sender.send(message);
  }
}
