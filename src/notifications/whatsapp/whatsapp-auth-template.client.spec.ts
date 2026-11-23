import { describe, expect, it, vi } from 'vitest';
import {
  WhatsappAuthTemplateClient,
  WhatsappDeliveryError,
} from './whatsapp-auth-template.client.js';

const config = {
  url: 'https://crm.example.com/api/v1/acme/whatsapp/auth-template',
  token: 'tu-token',
  inboxId: 'tu-inbox-id',
  templateName: 'autenticacion',
  languageCode: 'es',
};

function clientWith(fetchFn: typeof fetch) {
  return new WhatsappAuthTemplateClient(config, fetchFn);
}

describe('WhatsappAuthTemplateClient', () => {
  it('envía el body y los headers esperados', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 200 }),
    );

    await clientWith(fetchFn).sendAuthCode('573001234567', '123456');

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(config.url);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-api-token': 'tu-token',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      inboxId: 'tu-inbox-id',
      to: '573001234567',
      templateName: 'autenticacion',
      languageCode: 'es',
      code: '123456',
    });
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('acepta cualquier 2xx', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 202 }),
    );
    await expect(
      clientWith(fetchFn).sendAuthCode('573001234567', '123456'),
    ).resolves.toBeUndefined();
  });

  it('lanza WhatsappDeliveryError con status y detalle si no es 2xx', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('x'.repeat(900), { status: 422 }),
    );

    const error = await clientWith(fetchFn)
      .sendAuthCode('573001234567', '123456')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WhatsappDeliveryError);
    expect((error as WhatsappDeliveryError).status).toBe(422);
    expect((error as WhatsappDeliveryError).detail).toHaveLength(500);
  });

  it('lanza el error sin status si falla la red', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });

    const error = await clientWith(fetchFn)
      .sendAuthCode('573001234567', '123456')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WhatsappDeliveryError);
    expect((error as WhatsappDeliveryError).status).toBeUndefined();
    expect((error as WhatsappDeliveryError).detail).toBe('fetch failed');
  });

  it('trata el timeout como fallo de red', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });

    const error = await clientWith(fetchFn)
      .sendAuthCode('573001234567', '123456')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WhatsappDeliveryError);
    expect((error as WhatsappDeliveryError).status).toBeUndefined();
    expect((error as WhatsappDeliveryError).detail).toContain('timed out');
  });

  it('no incluye el token en el error', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('error', { status: 500 }),
    );
    const error = (await clientWith(fetchFn)
      .sendAuthCode('573001234567', '123456')
      .catch((e: unknown) => e)) as WhatsappDeliveryError;

    expect(JSON.stringify([error.message, error.detail])).not.toContain(
      'tu-token',
    );
  });
});
