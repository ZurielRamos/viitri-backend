import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailModule, Mailer } from '@nestjs/mail';
import { NotificationChannel } from './notification-channel.enum.js';
import {
  NOTIFICATION_SENDERS,
  type NotificationSender,
} from './notification-sender.js';
import { NotificationsService } from './notifications.service.js';
import { AccountMailService } from './mail/account-mail.service.js';
import { DEFAULT_MAIL_FROM, mailTransport } from './mail/mail.config.js';
import { WelcomeMail } from './mail/welcome.mail.js';
import { LogNotificationSender } from './senders/log.sender.js';
import { MailNotificationSender } from './senders/smtp-email.sender.js';

@Module({
  imports: [
    MailModule.forRootAsync({
      inject: [ConfigService],
      // Corre al arrancar: un SMTP_HOST o SMTP_PORT inválido detiene la app aquí.
      useFactory: (config: ConfigService) => ({
        transport: mailTransport({
          host: config.get<string>('SMTP_HOST'),
          port: Number(config.get<string>('SMTP_PORT', '587')),
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        }),
        from: config.get<string>('MAIL_FROM', DEFAULT_MAIL_FROM),
      }),
    }),
  ],
  providers: [
    {
      provide: NOTIFICATION_SENDERS,
      inject: [Mailer],
      // WhatsApp y SMS siguen en log hasta definir proveedor.
      useFactory: (mailer: Mailer): NotificationSender[] => [
        new MailNotificationSender(mailer),
        new LogNotificationSender(NotificationChannel.WhatsApp),
        new LogNotificationSender(NotificationChannel.Sms),
      ],
    },
    NotificationsService,
    WelcomeMail,
    AccountMailService,
  ],
  exports: [NotificationsService, AccountMailService],
})
export class NotificationsModule {}
