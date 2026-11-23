import type { NotificationChannel } from './notification-channel.enum.js';

export interface OutgoingMessage {
  /** Email o teléfono E.164 según el canal. */
  to: string;
  subject: string;
  body: string;
}

/**
 * Contrato que implementa cada proveedor (SMTP/SES, WhatsApp Business API,
 * Twilio, etc.). Para agregar uno, se implementa esta interfaz y se registra
 * en NotificationsModule bajo NOTIFICATION_SENDERS.
 */
export interface NotificationSender {
  readonly channel: NotificationChannel;
  send(message: OutgoingMessage): Promise<void>;
}

export const NOTIFICATION_SENDERS = Symbol('NOTIFICATION_SENDERS');
