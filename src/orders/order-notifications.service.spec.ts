import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Business } from '../businesses/entities/business.entity.js';
import type { Order } from './entities/order.entity.js';
import { OrderNotificationsService } from './order-notifications.service.js';
import { OrderSource, OrderStatus, OrderType } from './order.enums.js';

const business = {
  id: 'b1',
  slug: 'carritos',
  name: 'Carritos',
  profile: { logoUrl: null, timezone: 'America/Bogota' },
} as unknown as Business;

function order(partial: Partial<Order>): Order {
  return {
    id: 'o1',
    businessId: 'b1',
    number: 128,
    source: OrderSource.Customer,
    type: OrderType.Pickup,
    status: OrderStatus.Pending,
    customerId: 'c1',
    contactName: 'Laura Gómez',
    contactPhone: null,
    total: '54000',
    currency: 'COP',
    trackingLinkCode: null,
    cancellationReason: null,
    items: [{ quantity: 2 }, { quantity: 1 }],
    ...partial,
  } as unknown as Order;
}

function setup() {
  const push = { toStaff: vi.fn(() => 1), toCustomer: vi.fn(() => 1) };
  const whatsapp = { send: vi.fn(() => true), link: vi.fn(() => 'k7Qp2x') };
  const service = new OrderNotificationsService(
    { get: (_: string, d?: string) => d } as unknown as ConfigService,
    {} as never,
    whatsapp as never,
    {
      get: vi.fn(() => ({
        pickupEstimatedMinutes: 20,
        deliveryEstimatedMinutes: 40,
      })),
    } as never,
    push as never,
    { update: vi.fn() } as never,
    { findOne: vi.fn(() => business) } as never,
    {} as never,
  );
  return { service, push, whatsapp };
}

describe('OrderNotificationsService (push)', () => {
  it('avisa al equipo apenas llega un pedido de la tienda, aunque no tenga celular', async () => {
    const { service, push, whatsapp } = setup();
    await service.placed(business, order({}), 'token');
    expect(push.toStaff).toHaveBeenCalledWith('b1', {
      title: 'Pedido nuevo #128',
      body: expect.stringMatching(
        /^Laura Gómez · 3 productos · recoger · \$\s54\.000$/,
      ) as string,
      url: '/configuracion/pedidos/o1',
      tag: 'order-o1',
      icon: '/icons/viitri-192.png',
    });
    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  it('no avisa al equipo de los pedidos que toma el mismo equipo', async () => {
    const { service, push } = setup();
    await service.placed(business, order({ source: OrderSource.Staff }), 't');
    expect(push.toStaff).not.toHaveBeenCalled();
  });

  it('avisa al cliente cada cambio de estado, con la ruta de su pedido', async () => {
    const { service, push } = setup();
    await service.statusChanged(order({ status: OrderStatus.Accepted }));
    await service.statusChanged(order({ status: OrderStatus.Ready }));
    await service.statusChanged(
      order({
        status: OrderStatus.Rejected,
        cancellationReason: 'se acabó la carne',
      }),
    );
    const calls = push.toCustomer.mock.calls as unknown as [
      string,
      { title: string; body: string; url: string },
    ][];
    expect(calls.map(([, m]) => m.title)).toEqual([
      'Pedido aceptado',
      'Tu pedido está listo',
      'No pudimos atender tu pedido',
    ]);
    expect(calls[0][1].body).toBe(
      'Carritos aceptó tu pedido #128. Estará en unos 20 minutos.',
    );
    expect(calls[1][1].body).toBe(
      'Ya puedes recoger tu pedido #128 en Carritos.',
    );
    expect(calls[2][1].body).toBe(
      'Carritos no pudo atender tu pedido #128: se acabó la carne',
    );
    expect(
      calls.every(([id, m]) => id === 'c1' && m.url === '/mis-pedidos/o1'),
    ).toBe(true);
  });

  it('sin cliente (pedido en mesa sin datos) no envía push', async () => {
    const { service, push } = setup();
    await service.statusChanged(
      order({ customerId: null, status: OrderStatus.Accepted }),
    );
    expect(push.toCustomer).not.toHaveBeenCalled();
  });

  it('avisa al equipo si el cliente cancela', async () => {
    const { service, push } = setup();
    await service.cancelledByCustomer(order({ status: OrderStatus.Cancelled }));
    expect(push.toStaff).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        title: 'Pedido #128 cancelado',
        body: 'Laura Gómez canceló su pedido.',
      }),
    );
  });
});
