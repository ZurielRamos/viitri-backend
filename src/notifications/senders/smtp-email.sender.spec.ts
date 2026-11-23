import { InMemoryMailTransport, MailModule, Mailer } from '@nestjs/mail';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { NotificationChannel } from '../notification-channel.enum.js';
import { MailNotificationSender } from './smtp-email.sender.js';

describe('MailNotificationSender', () => {
  it('envía el mensaje como texto por el transporte de correo', async () => {
    const mailbox = new InMemoryMailTransport();
    const moduleRef = await Test.createTestingModule({
      imports: [
        MailModule.forRoot({
          transport: mailbox,
          from: 'viitri <no-reply@viitri.com>',
        }),
      ],
    }).compile();
    const sender = new MailNotificationSender(moduleRef.get(Mailer));

    await sender.send({
      to: 'invitado@example.com',
      subject: 'Invitación a Casa Verde',
      body: 'Acepta aquí: https://viitri.com/invitaciones/aceptar?token=abc',
    });

    expect(sender.channel).toBe(NotificationChannel.Email);
    const mail = mailbox.assertSent({ to: 'invitado@example.com' });
    expect(mail.subject).toBe('Invitación a Casa Verde');
    expect(mail.text).toContain('token=abc');
  });
});
