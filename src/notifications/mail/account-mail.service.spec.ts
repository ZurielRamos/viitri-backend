import { ConfigModule } from '@nestjs/config';
import { InMemoryMailTransport, MailModule, MailSmtpError } from '@nestjs/mail';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountMailService } from './account-mail.service.js';
import { WelcomeMail } from './welcome.mail.js';

describe('AccountMailService', () => {
  const mailbox = new InMemoryMailTransport();
  let service: AccountMailService;

  beforeEach(async () => {
    mailbox.clear();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ APP_URL: 'https://viitri.com' })],
        }),
        MailModule.forRoot({
          transport: mailbox,
          from: 'viitri <no-reply@viitri.com>',
          retry: false,
        }),
      ],
      providers: [WelcomeMail, AccountMailService],
    }).compile();
    service = moduleRef.get(AccountMailService);
  });

  it('envía la bienvenida con enlace al panel', async () => {
    await service.sendWelcome({ name: 'Ana', email: 'ana@example.com' });

    const mail = mailbox.assertSent({
      to: 'ana@example.com',
      mail: WelcomeMail,
    });
    expect(mail.subject).toContain('Ana');
    expect(mail.link('/panel').href).toBe('https://viitri.com/panel');
    expect(mail.html).toContain(
      'https://viitri.com/brand/viitri-logo-blue.png',
    );
  });

  it('escapa el HTML del nombre', async () => {
    await service.sendWelcome({
      name: '<script>x</script>',
      email: 'a@example.com',
    });

    const mail = mailbox.assertSent({ to: 'a@example.com' });
    expect(mail.html).not.toContain('<script>');
  });

  it('no lanza si el servidor de correo falla', async () => {
    mailbox.failNext(
      new MailSmtpError('RCPT TO', { code: 550, text: 'User unknown' }),
    );

    await expect(
      service.sendWelcome({ name: 'Ana', email: 'ana@example.com' }),
    ).resolves.toBeUndefined();
    mailbox.assertNotSent();
  });
});
