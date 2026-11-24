import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { ShortLinksService } from '../../links/short-links.service.js';
import { templatePayload } from './whatsapp-template.client.js';
import { WhatsappNotificationsService } from './whatsapp-notifications.service.js';

function service(env: Record<string, string>) {
  const config = {
    get: (key: string, fallback?: string) => env[key] ?? fallback,
  } as unknown as ConfigService;
  const links = { create: vi.fn(() => Promise.resolve('k7Qp2xAb')) };
  return {
    service: new WhatsappNotificationsService(
      config,
      links as unknown as ShortLinksService,
    ),
    links,
  };
}

describe('WhatsApp: plantillas', () => {
  it('arma los components como la API de WhatsApp Cloud: encabezado, cuerpo y un botón por sufijo', () => {
    const payload = templatePayload(
      { url: 'x', token: 't', inboxId: 'inbox' },
      '573001234567',
      'pedido_nuevo',
      'es_CO',
      {
        header: ['128'],
        body: ['Carritos', '3 productos'],
        urlButtons: ['k7Qp2xAb'],
      },
    );
    expect(payload).toEqual({
      inboxId: 'inbox',
      to: '573001234567',
      templateName: 'pedido_nuevo',
      languageCode: 'es_CO',
      components: [
        { type: 'header', parameters: [{ type: 'text', text: '128' }] },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Carritos' },
            { type: 'text', text: '3 productos' },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: 'k7Qp2xAb' }],
        },
      ],
    });
  });

  it('sin el nombre de la plantilla en el .env, no envía nada', async () => {
    const { service: s } = service({});
    expect(
      await s.send('planVenceHoy', '3001234567', {
        body: ['Carlos', 'Avanzado', 'Carritos'],
        buttons: [{ url: 'https://x' }],
      }),
    ).toBe(false);
  });

  it('crea el enlace corto del botón y normaliza el número (sin proveedor, lo escribe en el log)', async () => {
    const { service: s, links } = service({
      WHATSAPP_TEMPLATE_PLAN_VENCE_HOY: 'plan_vence_hoy',
    });
    const ok = await s.send('planVenceHoy', '300 123 4567', {
      body: ['Carlos', 'Avanzado', 'Carritos'],
      buttons: [
        { url: 'https://carritos.viitri.com/configuracion/plan', days: 30 },
      ],
    });
    expect(ok).toBe(true);
    expect(links.create).toHaveBeenCalledWith(
      'https://carritos.viitri.com/configuracion/plan',
      30,
    );
  });

  it('no envía si la cantidad de variables no coincide con la plantilla (Meta respondería 132000)', async () => {
    const { service: s } = service({
      WHATSAPP_TEMPLATE_PLAN_VENCE_HOY: 'plan_vence_hoy',
    });
    expect(
      await s.send('planVenceHoy', '3001234567', {
        body: ['Carlos'],
        buttons: [{ code: 'abc' }],
      }),
    ).toBe(false);
  });
});
