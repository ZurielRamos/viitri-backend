import { Injectable } from '@nestjs/common';
import { html, type Mailable } from '@nestjs/mail';

export interface PlanReminderData {
  name: string;
  businessName: string;
  planName: string;
  /** Días para que venza; 0: vence hoy; negativo: ya venció (en gracia). */
  daysLeft: number;
  /** "Tu plan" de la tienda, con el botón para pagar. */
  payUrl: string;
  price: string;
  logoUrl: string;
}

/** Aviso de que el plan está por vencer (o venció), con el enlace para pagar. */
@Injectable()
export class PlanReminderMail implements Mailable<PlanReminderData> {
  render(d: PlanReminderData) {
    const when =
      d.daysLeft > 1
        ? `vence en ${d.daysLeft} días`
        : d.daysLeft === 1
          ? 'vence mañana'
          : d.daysLeft === 0
            ? 'vence hoy'
            : 'ya venció';
    return {
      subject: `${d.businessName}: tu plan ${d.planName} ${when}`,
      html: html`
        <div style="font-family:Arial,sans-serif;color:#020a24;max-width:520px">
          <p>
            <img
              src="${d.logoUrl}"
              alt="viitri"
              width="120"
              style="display:block"
            />
          </p>
          <p>Hola ${d.name},</p>
          <p>
            El plan ${d.planName} de <b>${d.businessName}</b> ${when}. Págalo
            para que tus clientes sigan pidiendo desde tu menú: ${d.price} al
            mes.
          </p>
          ${
            d.daysLeft < 0
              ? html`<p>
                  Tienes unos días más antes de que tu tienda pase al plan
                  Básico (tu menú se sigue viendo, pero sin pedidos). No se
                  borra nada.
                </p>`
              : ''
          }
          <p>
            <a
              href="${d.payUrl}"
              style="display:inline-block;background:#0b5cff;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px"
              >Pagar mi plan</a
            >
          </p>
          <p>Puedes pagar con Nequi, tarjeta, PSE o Bancolombia.</p>
        </div>
      `,
    };
  }
}
