import { describe, expect, it } from 'vitest';
import {
  checkoutUrl,
  integritySignature,
  isAuthenticEvent,
  type WompiEvent,
} from './wompi.js';

// Ejemplos de la documentación de Wompi (docs.wompi.co).
describe('Wompi: firmas', () => {
  it('firma de integridad igual a la del ejemplo de Wompi', () => {
    expect(
      integritySignature(
        'sk8-438k4-xmxm392-sn2m',
        2490000,
        'COP',
        'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
      ),
    ).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  const event: WompiEvent = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: '1234-1610641025-49201',
        status: 'APPROVED',
        amount_in_cents: 4490000,
      },
    },
    environment: 'prod',
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      checksum:
        // El checksum de la documentación es ilustrativo (no es el SHA256 de su propia
        // cadena): este es el SHA256 real de esa cadena, en mayúsculas como lo manda Wompi.
        '5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE',
    },
    timestamp: 1530291411,
  };
  const secret = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';

  it('acepta el evento del ejemplo de Wompi', () => {
    expect(isAuthenticEvent(event, secret)).toBe(true);
  });

  it('rechaza un evento alterado, con otro secreto o sin firma', () => {
    const tampered = {
      ...event,
      data: {
        transaction: {
          ...(event.data.transaction as object),
          amount_in_cents: 100,
        },
      },
    };
    expect(isAuthenticEvent(tampered, secret)).toBe(false);
    expect(isAuthenticEvent(event, 'otro')).toBe(false);
    expect(isAuthenticEvent({ ...event, signature: undefined }, secret)).toBe(
      false,
    );
  });

  it('arma la URL del checkout con la firma y los datos del pagador', () => {
    const url = new URL(
      checkoutUrl(
        {
          publicKey: 'pub_test_x',
          integritySecret: 'test_integrity_y',
          eventsSecret: 'z',
          environment: 'test',
        },
        {
          reference: 'VT-1',
          amountInCents: 2990000,
          currency: 'COP',
          redirectUrl: 'https://carritos.viitri.com/configuracion/plan/pago',
        },
        { email: 'a@b.co', fullName: 'Ana', legalIdType: 'CC', legalId: '123' },
      ),
    );
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    expect(url.searchParams.get('signature:integrity')).toBe(
      integritySignature('VT-1', 2990000, 'COP', 'test_integrity_y'),
    );
    expect(url.searchParams.get('customer-data:legal-id')).toBe('123');
  });
});
