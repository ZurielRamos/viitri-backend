import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { PushDevice } from './push-device.entity.js';
import {
  PushService,
  isPushEndpoint,
  storeIcon,
  type WebPushSend,
} from './push.service.js';

const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';
const APPLE = 'https://web.push.apple.com/QGd1Zm9v';
const KEYS = { p256dh: 'BPk', auth: 'aut' };

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

/** Repositorio en memoria con lo que usa el servicio. */
function fakeRepo(rows: PushDevice[] = []) {
  let seq = rows.length;
  const matches = (row: PushDevice, where: Partial<PushDevice>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof PushDevice] === v);
  const repo = {
    rows,
    findOneBy: vi.fn((where: Partial<PushDevice>) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    ),
    findBy: vi.fn((where: Partial<PushDevice>) =>
      Promise.resolve(rows.filter((r) => matches(r, where))),
    ),
    existsBy: vi.fn((where: Partial<PushDevice>) =>
      Promise.resolve(rows.some((r) => matches(r, where))),
    ),
    create: vi.fn((data: Partial<PushDevice>) => ({ ...data }) as PushDevice),
    save: vi.fn((device: PushDevice) => {
      const index = rows.findIndex((r) => r.id === device.id);
      if (index >= 0) Object.assign(rows[index], device);
      else rows.push(Object.assign(device, { id: device.id ?? `d${++seq}` }));
      return Promise.resolve(device);
    }),
    remove: vi.fn((device: PushDevice) => {
      rows.splice(
        rows.findIndex((r) => r.id === device.id),
        1,
      );
      return Promise.resolve(device);
    }),
    delete: vi.fn(({ id }: { id: string }) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) rows.splice(index, 1);
      return Promise.resolve({});
    }),
  };
  return repo;
}

function device(partial: Partial<PushDevice>): PushDevice {
  return {
    id: 'd1',
    endpoint: FCM,
    p256dh: 'BPk',
    auth: 'aut',
    businessId: 'b1',
    userId: null,
    customerId: null,
    ...partial,
  } as PushDevice;
}

function service(
  repo: ReturnType<typeof fakeRepo>,
  send: WebPushSend = vi.fn(() =>
    Promise.resolve({ statusCode: 201, body: '', headers: {} }),
  ),
  keys = true,
) {
  return new PushService(
    config(keys ? { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' } : {}),
    repo as unknown as Repository<PushDevice>,
    send,
  );
}

describe('isPushEndpoint', () => {
  it('acepta los servicios de push de los navegadores', () => {
    expect(isPushEndpoint(FCM)).toBe(true);
    expect(isPushEndpoint(APPLE)).toBe(true);
    expect(
      isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'),
    ).toBe(true);
    expect(
      isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?t=1'),
    ).toBe(true);
  });

  it('rechaza cualquier otra dirección (la API no hace peticiones a donde le digan)', () => {
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/a')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/a')).toBe(false);
    expect(isPushEndpoint('https://evil.com/push.apple.com')).toBe(false);
    expect(isPushEndpoint('https://push.apple.com.evil.com/a')).toBe(false);
    expect(isPushEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(isPushEndpoint('no es url')).toBe(false);
  });
});

describe('storeIcon', () => {
  it('usa el ícono de la app de la tienda, o el de viitri', () => {
    expect(
      storeIcon({
        profile: { logoUrl: 'https://cdn/x/logo-1.webp' },
      } as never),
    ).toBe('https://cdn/x/logo-1-icon-192.png');
    expect(storeIcon({ profile: { logoUrl: null } } as never)).toBe(
      '/icons/viitri-192.png',
    );
  });
});

describe('PushService', () => {
  it('sin claves VAPID no ofrece los avisos', () => {
    expect(service(fakeRepo(), undefined, false).publicKey()).toBeNull();
    expect(service(fakeRepo()).publicKey()).toBe('pub');
  });

  it('registra el celular y conserva a la otra persona del mismo teléfono', async () => {
    const repo = fakeRepo([device({ userId: 'u1' })]);
    const push = service(repo);
    await expect(
      push.register('b1', { endpoint: FCM, keys: KEYS }, { customerId: 'c1' }),
    ).resolves.toBe(true);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]).toMatchObject({ userId: 'u1', customerId: 'c1' });
  });

  it('no registra direcciones que no son de push', async () => {
    const repo = fakeRepo();
    await expect(
      service(repo).register(
        'b1',
        { endpoint: 'https://evil.com/x', keys: KEYS },
        { userId: 'u1' },
      ),
    ).resolves.toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('un celular que pasa a otra tienda empieza sin dueño anterior', async () => {
    const repo = fakeRepo([device({ businessId: 'b2', customerId: 'c9' })]);
    await service(repo).register(
      'b1',
      { endpoint: FCM, keys: KEYS },
      { userId: 'u1' },
    );
    expect(repo.rows[0]).toMatchObject({
      businessId: 'b1',
      userId: 'u1',
      customerId: null,
    });
  });

  it('al desactivarlos solo quita a esa persona; sin nadie, borra el celular', async () => {
    const repo = fakeRepo([device({ userId: 'u1', customerId: 'c1' })]);
    const push = service(repo);
    await push.unregister(FCM, { userId: 'otro' });
    expect(repo.rows[0]).toMatchObject({ userId: 'u1', customerId: 'c1' });
    await push.unregister(FCM, { userId: 'u1' });
    expect(repo.rows[0]).toMatchObject({ userId: null, customerId: 'c1' });
    await push.unregister(FCM, { customerId: 'c1' });
    expect(repo.rows).toHaveLength(0);
  });

  it('envía al cliente y borra los celulares que ya no existen (410)', async () => {
    const repo = fakeRepo([
      device({ id: 'd1', customerId: 'c1' }),
      device({ id: 'd2', endpoint: APPLE, customerId: 'c1' }),
    ]);
    const send = vi.fn((sub: { endpoint: string }) =>
      sub.endpoint === APPLE
        ? Promise.reject(Object.assign(new Error('Gone'), { statusCode: 410 }))
        : Promise.resolve({ statusCode: 201, body: '', headers: {} }),
    );
    const push = service(repo, send as unknown as WebPushSend);
    const sent = await push.toCustomer('c1', {
      title: 'Tu pedido está listo',
      body: 'Ya puedes recogerlo.',
      url: '/mis-pedidos/o1',
    });
    expect(sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    const [, payload, options] = send.mock.calls[0] as unknown as [
      unknown,
      string,
      { urgency: string; vapidDetails: { publicKey: string } },
    ];
    expect(JSON.parse(payload)).toMatchObject({ url: '/mis-pedidos/o1' });
    expect(options).toMatchObject({
      urgency: 'high',
      vapidDetails: { publicKey: 'pub' },
    });
    expect(repo.rows.map((r) => r.id)).toEqual(['d1']);
  });

  it('sin claves VAPID solo escribe en el log', async () => {
    const repo = fakeRepo([device({ customerId: 'c1' })]);
    const send = vi.fn();
    const push = service(repo, send as unknown as WebPushSend, false);
    await expect(
      push.toCustomer('c1', { title: 't', body: 'b', url: '/' }),
    ).resolves.toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('sin cliente no envía nada', async () => {
    const repo = fakeRepo();
    await expect(
      service(repo).toCustomer(null, { title: 't', body: 'b', url: '/' }),
    ).resolves.toBe(0);
    expect(repo.findBy).not.toHaveBeenCalled();
  });
});
