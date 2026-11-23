import { Injectable } from '@nestjs/common';
import { html, type Mailable } from '@nestjs/mail';

export interface WelcomeData {
  name: string;
  /** Enlace al panel donde se crea el primer negocio. */
  panelUrl: string;
  /** Logo azul de viitri, servido por la web. */
  logoUrl: string;
}

/** Bienvenida tras el registro. `html` escapa cada valor interpolado. */
@Injectable()
export class WelcomeMail implements Mailable<WelcomeData> {
  render({ name, panelUrl, logoUrl }: WelcomeData) {
    return {
      subject: `¡Bienvenido a viitri, ${name}!`,
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
            Tu cuenta en viitri está lista. Ya puedes crear tu primer negocio y
            publicarlo en tu propio subdominio.
          </p>
          <p>
            <a
              href="${panelUrl}"
              style="display:inline-block;background:#0b5cff;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px"
              >Ir a mi panel</a
            >
          </p>
          <p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
        </div>
      `,
    };
  }
}
