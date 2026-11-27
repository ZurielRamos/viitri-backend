import { Injectable } from '@nestjs/common';
import { html, type Mailable } from '@nestjs/mail';

export interface PasswordResetData {
  name: string;
  /** Enlace de un solo uso para elegir una contraseña nueva. */
  resetUrl: string;
  /** Minutos que vale el enlace. */
  expiresInMinutes: number;
  /** Logo azul de viitri, servido por la web. */
  logoUrl: string;
}

/** Recuperación de contraseña. `html` escapa cada valor interpolado. */
@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetData> {
  render({ name, resetUrl, expiresInMinutes, logoUrl }: PasswordResetData) {
    return {
      subject: 'Recupera tu contraseña de viitri',
      html: html`
        <div style="font-family:Arial,sans-serif;color:#020a24;max-width:520px">
          <p>
            <img
              src="${logoUrl}"
              alt="viitri"
              width="120"
              style="display:block"
            />
          </p>
          <p>Hola ${name},</p>
          <p>
            Recibimos una solicitud para cambiar tu contraseña. El enlace vale
            ${expiresInMinutes} minutos y solo se puede usar una vez.
          </p>
          <p>
            <a
              href="${resetUrl}"
              style="display:inline-block;background:#0b5cff;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px"
              >Elegir contraseña nueva</a
            >
          </p>
          <p>Si no fuiste tú, ignora este correo: tu contraseña sigue igual.</p>
        </div>
      `,
    };
  }
}
