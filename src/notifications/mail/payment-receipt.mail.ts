import { Injectable } from '@nestjs/common';
import { html, type Mailable } from '@nestjs/mail';

export interface PaymentReceiptData {
  name: string;
  businessName: string;
  planName: string;
  amount: string;
  /** Hasta cuándo quedó pagado, ya en texto ("23 de diciembre de 2026"). */
  paidUntil: string;
  reference: string;
  logoUrl: string;
}

/** Comprobante del pago aprobado. */
@Injectable()
export class PaymentReceiptMail implements Mailable<PaymentReceiptData> {
  render(d: PaymentReceiptData) {
    return {
      subject: `Recibimos tu pago: ${d.businessName} tiene el plan ${d.planName}`,
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
          <p>Recibimos tu pago de <b>${d.amount}</b>. ¡Gracias!</p>
          <p>
            El plan ${d.planName} de <b>${d.businessName}</b> queda pagado hasta
            el ${d.paidUntil}. Te avisaremos unos días antes de que venza.
          </p>
          <p style="color:#5b6478;font-size:13px">Referencia: ${d.reference}</p>
        </div>
      `,
    };
  }
}
