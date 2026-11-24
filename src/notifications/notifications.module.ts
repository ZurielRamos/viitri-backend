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
import { PaymentReceiptMail } from './mail/payment-receipt.mail.js';
import { PlanReminderMail } from './mail/plan-reminder.mail.js';
import { WelcomeMail } from './mail/welcome.mail.js';
import { LinksModule } from '../links/links.module.js';
import { WhatsappNotificationsService } from './whatsapp/whatsapp-notifications.service.js';
import { LogNotificationSender } from './senders/log.sender.js';
import { MailNotificationSender } from './senders/smtp-email.sender.js';

@Module({
  imports: [
    // Enlaces cortos para los botones de las plantillas de WhatsApp.
    LinksModule,
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
    PlanReminderMail,
    PaymentReceiptMail,
    AccountMailService,
    WhatsappNotificationsService,
  ],
  exports: [
    NotificationsService,
    AccountMailService,
    WhatsappNotificationsService,
  ],
})
export class NotificationsModule {}
