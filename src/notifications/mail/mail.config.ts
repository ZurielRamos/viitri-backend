import {
  FileMailTransport,
  SmtpTransport,
  type MailTransport,
} from '@nestjs/mail';

export const DEFAULT_MAIL_FROM = 'viitri <no-reply@viitri.com>';

export interface SmtpSettings {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
}

/**
 * Con `SMTP_HOST` los correos salen por SMTP. El puerto 465 usa TLS directo;
 * en 587 y 2525 se sube a TLS con STARTTLS, que es obligatorio. Sin host, en
 * desarrollo se escriben como archivos .eml en `var/mail`.
 */
export function mailTransport({
  host,
  port = 587,
  user,
  pass,
}: SmtpSettings): MailTransport {
  if (!host) return new FileMailTransport({ directory: 'var/mail' });
  return new SmtpTransport({
    host,
    port,
    secure: port === 465,
    ...(user && pass && { auth: { user, pass } }),
    pool: true,
  });
}
