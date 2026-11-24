import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { DataSource, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessMember } from '../businesses/entities/business-member.entity.js';
import type { Business } from '../businesses/entities/business.entity.js';
import type { TtlStore } from '../common/ttl-store/ttl-store.js';
import type { AccountMailService } from '../notifications/mail/account-mail.service.js';
import type { WhatsappNotificationsService } from '../notifications/whatsapp/whatsapp-notifications.service.js';
import type { PushService } from '../push/push.service.js';
import { BillingService, addMonths } from './billing.service.js';
import type { PlanPayment } from './plan-payment.entity.js';
import type { WompiEvent } from './wompi.js';

const EVENTS_SECRET = 'test_events_secret';
const DAY = 86_400_000;

/** Un evento de Wompi firmado como lo firma Wompi. */
function signed(
  tx: { id: string; status: string; amount_in_cents: number } & Record<
    string,
    unknown
  >,
  environment = 'test',
): WompiEvent {
  const timestamp = 1_700_000_000;
  const properties = [
    'transaction.id',
    'transaction.status',
    'transaction.amount_in_cents',
  ];
  const checksum = createHash('sha256')
    .update(
      `${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${EVENTS_SECRET}`,
    )
    .digest('hex')
    .toUpperCase();
  return {
    event: 'transaction.updated',
    data: { transaction: tx },
    environment,
    signature: { properties, checksum },
    timestamp,
  };
}

describe('BillingService', () => {
  let payment: PlanPayment;
  let business: Business;
  let mail: {
    sendPaymentReceipt: ReturnType<typeof vi.fn>;
    sendPlanReminder: ReturnType<typeof vi.fn>;
    logoUrl: () => string;
  };
  let service: BillingService;
  let ttlKeys: Set<string>;
  let whatsapp: { send: ReturnType<typeof vi.fn> };
  let push: { toOwner: ReturnType<typeof vi.fn> };
  /** Títulos de los push al dueño, en orden. */
  const pushTitles = () =>
    push.toOwner.mock.calls.map((call) => (call[1] as { title: string }).title);

  beforeEach(() => {
    payment = {
      id: 'p1',
      businessId: 'b1',
      plan: 'advanced',
      months: 1,
      amountInCents: 2_990_000,
      currency: 'COP',
      reference: 'VT-1',
      status: 'pending',
      billing: {
        fullName: 'Ana',
        email: 'ana@x.co',
        legalIdType: 'CC',
        legalId: '123',
      },
    } as PlanPayment;
    business = {
      id: 'b1',
      name: 'Carritos',
      slug: 'carritos',
      plan: 'advanced',
      trialEndsAt: null,
      paidUntil: null,
      billingProfile: null,
    } as unknown as Business;
    const manager = {
      findOne: vi.fn(() => Promise.resolve(payment)),
      findOneOrFail: vi.fn(() => Promise.resolve(business)),
      save: vi.fn((x: unknown) => Promise.resolve(x)),
    };
    const dataSource = {
      transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
    };
    const config = {
      get: (key: string, fallback?: string) =>
        ({
          WOMPI_PUBLIC_KEY: 'pub_test_x',
          WOMPI_INTEGRITY_SECRET: 'test_integrity_y',
          WOMPI_EVENTS_SECRET: EVENTS_SECRET,
          APP_URL: 'https://viitri.com',
        })[key] ?? fallback,
    };
    mail = {
      sendPaymentReceipt: vi.fn(() => Promise.resolve()),
      sendPlanReminder: vi.fn(() => Promise.resolve(true)),
      logoUrl: () => 'https://viitri.com/logo.png',
    };
    whatsapp = { send: vi.fn(() => Promise.resolve(true)) };
    push = { toOwner: vi.fn(() => Promise.resolve(1)) };
    ttlKeys = new Set();
    const ttl = {
      setIfAbsent: vi.fn((key: string) => {
        if (ttlKeys.has(key)) return Promise.resolve(false);
        ttlKeys.add(key);
        return Promise.resolve(true);
      }),
      delete: vi.fn(),
    };
    const businesses = {
      find: vi.fn(() => Promise.resolve([business])),
      findOneBy: vi.fn(() => Promise.resolve(business)),
    };
    const members = {
      findOne: vi.fn(() =>
        Promise.resolve({
          user: { name: 'Ana Gómez', email: 'ana@x.co', phone: '573001234567' },
        }),
      ),
    };
    service = new BillingService(
      config as unknown as ConfigService,
      dataSource as unknown as DataSource,
      mail as unknown as AccountMailService,
      whatsapp as unknown as WhatsappNotificationsService,
      push as unknown as PushService,
      ttl as unknown as TtlStore,
      {} as Repository<PlanPayment>,
      businesses as unknown as Repository<Business>,
      members as unknown as Repository<BusinessMember>,
    );
  });

  const approvedTx = {
    id: 'tx1',
    reference: 'VT-1',
    status: 'APPROVED',
    amount_in_cents: 2_990_000,
    currency: 'COP',
    payment_method_type: 'NEQUI',
  };

  it('un pago aprobado deja el plan pagado un mes y manda el comprobante', async () => {
    const before = Date.now();
    await service.handleEvent(signed(approvedTx));
    expect(payment.status).toBe('approved');
    expect(payment.paymentMethodType).toBe('NEQUI');
    expect(business.paidUntil!.getTime()).toBeGreaterThan(before + 27 * DAY);
    expect(mail.sendPaymentReceipt).toHaveBeenCalledOnce();
    expect(whatsapp.send).toHaveBeenCalledWith(
      'pagoRecibido',
      '573001234567',
      expect.objectContaining({
        body: expect.arrayContaining(['Ana', 'Avanzado', 'Carritos', 'VT-1']),
      }),
    );
    expect(pushTitles()).toEqual(['Recibimos tu pago']);
  });

  it('un pago rechazado avisa por WhatsApp para intentarlo otra vez', async () => {
    await service.handleEvent(signed({ ...approvedTx, status: 'DECLINED' }));
    expect(payment.status).toBe('declined');
    expect(whatsapp.send).toHaveBeenCalledWith(
      'pagoRechazado',
      '573001234567',
      expect.anything(),
    );
    expect(pushTitles()).toEqual(['Tu pago no se aprobó']);
    expect(business.paidUntil).toBeNull();
  });

  it('si paga antes de vencer, el mes nuevo empieza al terminar lo cubierto', async () => {
    const trialEnd = new Date(Date.now() + 5 * DAY);
    business.trialEndsAt = trialEnd;
    await service.handleEvent(signed(approvedTx));
    expect(payment.periodStart).toEqual(trialEnd);
    expect(business.paidUntil).toEqual(addMonths(trialEnd, 1));
  });

  it('el mismo evento repetido no suma otro mes', async () => {
    await service.handleEvent(signed(approvedTx));
    const paidUntil = business.paidUntil;
    await service.handleEvent(signed(approvedTx));
    expect(business.paidUntil).toBe(paidUntil);
    expect(mail.sendPaymentReceipt).toHaveBeenCalledOnce();
  });

  it('rechaza eventos sin firma válida, e ignora otro ambiente o un monto distinto', async () => {
    const forged = signed(approvedTx);
    forged.signature!.checksum = 'ABC';
    await expect(service.handleEvent(forged)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    await service.handleEvent(signed(approvedTx, 'prod'));
    expect(payment.status).toBe('pending');

    await service.handleEvent(signed({ ...approvedTx, amount_in_cents: 100 }));
    expect(payment.status).toBe('error');
    expect(business.paidUntil).toBeNull();
  });

  it('avisa 7, 3 y 1 días antes, el día, el último de gracia y al pasar a Básico, una sola vez cada uno', async () => {
    const end = new Date('2026-06-20T12:00:00Z');
    business.paidUntil = end;
    const at = (daysBefore: number) =>
      new Date(end.getTime() - daysBefore * DAY);
    for (const d of [7, 6, 3, 1, 0, -1, -2, -3])
      await service.sendReminders(at(d));
    await service.sendReminders(at(3));
    const mails = mail.sendPlanReminder.mock.calls.map(
      (call) => (call[1] as { daysLeft: number }).daysLeft,
    );
    expect(mails).toEqual([7, 3, 1, 0, -2]);
    const templates = whatsapp.send.mock.calls.map((call) => call[0] as string);
    expect(templates).toEqual([
      'planPorVencer',
      'planPorVencer',
      'planPorVencer',
      'planVenceHoy',
      'planUltimoDia',
      'planPasoABasico',
    ]);
    expect(pushTitles()).toEqual([
      'Tu plan vence en 7 días',
      'Tu plan vence en 3 días',
      'Tu plan vence mañana',
      'Tu plan vence hoy',
      'Último día para pagar tu plan',
      'Tu tienda pasó al plan Básico',
    ]);
    expect(push.toOwner).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({
        url: '/configuracion/plan',
        tag: 'plan-b1',
      }),
    );
  });
  it('si el dueño solo tiene los avisos push, el aviso cuenta como enviado', async () => {
    mail.sendPlanReminder.mockResolvedValue(false);
    whatsapp.send.mockResolvedValue(false);
    const end = new Date('2026-06-20T12:00:00Z');
    business.paidUntil = end;
    await expect(
      service.sendReminders(new Date(end.getTime() - 3 * DAY)),
    ).resolves.toBe(1);
    push.toOwner.mockResolvedValue(0);
    await expect(
      service.sendReminders(new Date(end.getTime() - 1 * DAY)),
    ).resolves.toBe(0);
  });

  it('en la prueba gratis, el WhatsApp es "tu prueba está por terminar" (3 y 1 días antes)', async () => {
    const end = new Date('2026-06-20T12:00:00Z');
    business.trialEndsAt = end;
    for (const d of [7, 3, 1])
      await service.sendReminders(new Date(end.getTime() - d * DAY));
    const templates = whatsapp.send.mock.calls.map((call) => call[0] as string);
    expect(templates).toEqual(['pruebaPorTerminar', 'pruebaPorTerminar']);
    // El push avisa los mismos días que el correo.
    expect(pushTitles()).toEqual([
      'Tu prueba gratis termina en 7 días',
      'Tu prueba gratis termina en 3 días',
      'Tu prueba gratis termina mañana',
    ]);
    // Dos botones (pagar y ver los planes).
    expect(
      (whatsapp.send.mock.calls[0][2] as { buttons: unknown[] }).buttons,
    ).toHaveLength(2);
  });

  it('addMonths respeta el fin de mes', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T10:00:00.000Z',
    );
    expect(addMonths(new Date('2026-03-15T10:00:00Z'), 1).toISOString()).toBe(
      '2026-04-15T10:00:00.000Z',
    );
  });
});
