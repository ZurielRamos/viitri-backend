import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, Not, Repository } from 'typeorm';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import {
  CURRENCY,
  GRACE_DAYS,
  coveredUntil,
  planDefinition,
  planStatus,
  type Plan,
} from '../businesses/plans/plans.js';
import { TTL_STORE, type TtlStore } from '../common/ttl-store/ttl-store.js';
import { storeUrl } from '../common/store-url.js';
import { AccountMailService } from '../notifications/mail/account-mail.service.js';
import {
  WhatsappNotificationsService,
  cop,
  firstName,
} from '../notifications/whatsapp/whatsapp-notifications.service.js';
import { PushService, type PushMessage } from '../push/push.service.js';
import {
  PlanPayment,
  type BillingDetails,
  type PlanPaymentStatus,
} from './plan-payment.entity.js';
import {
  checkoutUrl,
  isAuthenticEvent,
  type WompiConfig,
  type WompiEvent,
} from './wompi.js';

const DAY_MS = 86_400_000;
/** Días antes del vencimiento en que se avisa (0: el mismo día). Luego, el último día de gracia. */
export const REMINDER_DAYS = [7, 3, 1, 0];
/** "Tu plan" en la tienda: ahí se paga. */
const PLAN_PATH = '/configuracion/plan';

/**
 * El push de cada aviso del plan. Viene de viitri (con su ícono) y reemplaza
 * al anterior del mismo negocio: en el celular queda solo el último.
 */
export function planReminderPush(input: {
  businessId: string;
  businessName: string;
  planName: string;
  price: string;
  daysLeft: number;
  inTrial: boolean;
  lastGraceDay: boolean;
  downgraded: boolean;
}): PushMessage {
  const { businessName: store, planName: plan, daysLeft } = input;
  const when = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
  const base = { url: PLAN_PATH, tag: `plan-${input.businessId}` };
  if (input.downgraded)
    return {
      ...base,
      title: 'Tu tienda pasó al plan Básico',
      body: `El plan ${plan} de ${store} venció. Tu menú se sigue viendo, pero sin pedidos. Al pagar, todo vuelve como estaba.`,
    };
  if (input.lastGraceDay)
    return {
      ...base,
      title: 'Último día para pagar tu plan',
      body: `Mañana ${store} deja de recibir pedidos. Paga el plan ${plan} hoy y todo sigue igual.`,
    };
  if (daysLeft === 0)
    return input.inTrial
      ? {
          ...base,
          title: 'Tu prueba gratis termina hoy',
          body: `Paga el plan ${plan} (${input.price} al mes) para que ${store} siga recibiendo pedidos.`,
        }
      : {
          ...base,
          title: 'Tu plan vence hoy',
          body: `Si pagas hoy el plan ${plan} de ${store}, todo sigue igual. Si no, tienes ${GRACE_DAYS} días más antes de que deje de recibir pedidos.`,
        };
  return input.inTrial
    ? {
        ...base,
        title: `Tu prueba gratis termina ${when}`,
        body: `Paga el plan ${plan} (${input.price} al mes, sin permanencia) para que ${store} siga recibiendo pedidos.`,
      }
    : {
        ...base,
        title: `Tu plan vence ${when}`,
        body: `El plan ${plan} de ${store} vence ${when}. Son ${input.price} al mes y puedes pagar con Nequi, tarjeta, PSE o Bancolombia.`,
      };
}

const STATUS: Record<string, PlanPaymentStatus> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED: 'voided',
  ERROR: 'error',
};

const money = (cents: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(cents / 100);

/** Un mes calendario después (el 31 pasa al último día del mes siguiente). */
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next;
}

/**
 * Cobro de los planes con Wompi, sin cobro automático: el dueño paga cada mes
 * desde "Tu plan" (le avisamos antes del vencimiento). El plan solo se activa
 * con el evento firmado de Wompi, nunca con la redirección del navegador.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly mail: AccountMailService,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly push: PushService,
    @Inject(TTL_STORE) private readonly ttl: TtlStore,
    @InjectRepository(PlanPayment)
    private readonly payments: Repository<PlanPayment>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {}

  private wompi(): WompiConfig | null {
    const publicKey = this.config.get<string>('WOMPI_PUBLIC_KEY');
    const integritySecret = this.config.get<string>('WOMPI_INTEGRITY_SECRET');
    const eventsSecret = this.config.get<string>('WOMPI_EVENTS_SECRET');
    if (!publicKey || !integritySecret || !eventsSecret) return null;
    // Las llaves de Sandbox empiezan por pub_test_.
    return {
      publicKey,
      integritySecret,
      eventsSecret,
      environment: publicKey.startsWith('pub_test_') ? 'test' : 'prod',
    };
  }

  /** Estado del plan, datos de facturación guardados y los últimos pagos. */
  async overview(businessId: string) {
    const business = await this.businesses.findOneByOrFail({ id: businessId });
    const history = await this.payments.find({
      where: { businessId, status: Not('pending') },
      order: { createdAt: 'DESC' },
      take: 12,
    });
    return {
      plan: business.plan,
      ...planStatus(business),
      coveredUntil: coveredUntil(business),
      billingProfile: business.billingProfile,
      payments: history.map((p) => ({
        id: p.id,
        plan: p.plan,
        amount: p.amountInCents / 100,
        status: p.status,
        paymentMethodType: p.paymentMethodType,
        periodEnd: p.periodEnd,
        createdAt: p.createdAt,
      })),
      enabled: this.wompi() !== null,
    };
  }

  /** El último pago, para la pantalla de "confirmando tu pago". */
  async latest(businessId: string, reference?: string) {
    const payment = await this.payments.findOne({
      where: reference ? { businessId, reference } : { businessId },
      order: { createdAt: 'DESC' },
    });
    return (
      payment && {
        reference: payment.reference,
        status: payment.status,
        plan: payment.plan,
        periodEnd: payment.periodEnd,
      }
    );
  }

  /**
   * Crea el pago pendiente y devuelve la URL del checkout de Wompi, firmada.
   * `redirectUrl` debe ser de una tienda de viitri (subdominio de APP_URL).
   */
  async checkout(
    businessId: string,
    plan: Exclude<Plan, 'basic'>,
    billing: BillingDetails,
    redirectUrl: string,
  ): Promise<{ checkoutUrl: string; reference: string }> {
    const wompi = this.wompi();
    if (!wompi)
      throw new ServiceUnavailableException(
        'Los pagos no están disponibles ahora. Escríbenos y activamos tu plan.',
      );
    this.assertOwnUrl(redirectUrl);
    const amountInCents = planDefinition(plan).monthlyPrice * 100;
    const reference = `VT-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    await this.payments.save(
      this.payments.create({
        businessId,
        plan,
        months: 1,
        amountInCents,
        currency: CURRENCY,
        reference,
        billing,
      }),
    );
    await this.businesses.update(businessId, { billingProfile: billing });
    const url = new URL(redirectUrl);
    url.searchParams.set('ref', reference);
    return {
      reference,
      checkoutUrl: checkoutUrl(
        wompi,
        {
          reference,
          amountInCents,
          currency: CURRENCY,
          redirectUrl: url.toString(),
        },
        billing,
      ),
    };
  }

  /**
   * Evento de Wompi. Solo se confía en él si su firma es válida, es del
   * ambiente de las llaves y el monto coincide con el pago. Repetirlo no
   * suma otro mes: un pago aprobado no se vuelve a aplicar.
   */
  async handleEvent(event: WompiEvent, headerChecksum?: string): Promise<void> {
    const wompi = this.wompi();
    if (!wompi) throw new ServiceUnavailableException();
    if (!isAuthenticEvent(event, wompi.eventsSecret, headerChecksum)) {
      throw new UnauthorizedException('Firma inválida.');
    }
    if (
      event.environment !== wompi.environment ||
      event.event !== 'transaction.updated'
    )
      return;
    const tx = event.data.transaction as
      | {
          id: string;
          reference: string;
          status: string;
          amount_in_cents: number;
          currency: string;
          payment_method_type?: string;
        }
      | undefined;
    if (!tx?.reference) return;
    const status = STATUS[tx.status];
    if (!status) return;

    type Outcome =
      | { declined: PlanPayment }
      | { payment: PlanPayment; business: Business }
      | null;
    const approved = await this.dataSource.transaction(
      async (manager): Promise<Outcome> => {
        const payment = await manager.findOne(PlanPayment, {
          where: { reference: tx.reference },
          lock: { mode: 'pessimistic_write' },
        });
        if (!payment || payment.status === 'approved') return null;
        if (
          tx.amount_in_cents !== payment.amountInCents ||
          tx.currency !== payment.currency
        ) {
          this.logger.error(
            `Pago ${payment.reference}: el monto de Wompi no coincide (${tx.amount_in_cents} ${tx.currency}).`,
          );
          payment.status = 'error';
          payment.wompiTransactionId = tx.id;
          await manager.save(payment);
          return null;
        }
        payment.status = status;
        payment.wompiTransactionId = tx.id;
        payment.paymentMethodType = tx.payment_method_type ?? null;
        if (status !== 'approved') {
          await manager.save(payment);
          return { declined: payment };
        }
        const business = await manager.findOneOrFail(Business, {
          where: { id: payment.businessId },
          lock: { mode: 'pessimistic_write' },
        });
        // Si paga antes de que venza, no pierde días: el mes nuevo empieza al terminar lo cubierto.
        const now = new Date();
        const covered = coveredUntil(business);
        const start = covered && covered > now ? covered : now;
        const end = addMonths(start, payment.months);
        business.plan = payment.plan;
        business.paidUntil = end;
        payment.periodStart = start;
        payment.periodEnd = end;
        payment.approvedAt = now;
        await manager.save(business);
        await manager.save(payment);
        return { payment, business };
      },
    );

    if (!approved) return;
    if ('declined' in approved) await this.notifyDeclined(approved.declined);
    else await this.sendReceipt(approved.business, approved.payment);
  }

  /**
   * Avisos de vencimiento por correo, WhatsApp y push: 7, 3 y 1 días antes,
   * el mismo día, el último día de gracia y, al terminar la gracia, que la
   * tienda pasó a Básico. En la prueba gratis, el de WhatsApp es "tu prueba
   * está por terminar" (3 y 1 días antes); el push avisa los mismos días que
   * el correo. Cada aviso sale una sola vez.
   */
  async sendReminders(now = new Date()): Promise<number> {
    const candidates = await this.businesses.find({
      where: { plan: Not('basic') },
    });
    let sent = 0;
    for (const business of candidates) {
      const until = coveredUntil(business);
      if (!until) continue;
      const daysLeft = Math.ceil((until.getTime() - now.getTime()) / DAY_MS);
      const lastGraceDay = daysLeft === -(GRACE_DAYS - 1);
      const downgraded = daysLeft === -GRACE_DAYS;
      if (!REMINDER_DAYS.includes(daysLeft) && !lastGraceDay && !downgraded)
        continue;
      const key = `plan-reminder:${business.id}:${until.toISOString().slice(0, 10)}:${daysLeft}`;
      if (!(await this.ttl.setIfAbsent(key, 1, 40 * 24 * 60 * 60))) continue;
      const owner = await this.ownerContact(business);
      if (!owner) continue;
      const plan = planDefinition(business.plan);
      const price = money(plan.monthlyPrice * 100);
      const payUrl = storeUrl(
        this.config,
        business.slug,
        '/configuracion/plan',
      );
      const inTrial =
        !business.paidUntil || business.paidUntil.getTime() < until.getTime();
      let ok = false;
      if (owner.email && !downgraded) {
        ok = await this.mail.sendPlanReminder(
          { name: owner.name, email: owner.email },
          {
            name: owner.name,
            businessName: business.name,
            planName: plan.name,
            daysLeft,
            payUrl,
            price,
            logoUrl: this.mail.logoUrl(),
          },
        );
      }
      const who = firstName(owner.name);
      const button = [{ url: payUrl, days: 30 }];
      const when = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
      if (downgraded) {
        ok =
          (await this.whatsapp.send('planPasoABasico', owner.phone, {
            body: [who, plan.name, business.name],
            buttons: button,
          })) || ok;
      } else if (lastGraceDay) {
        ok =
          (await this.whatsapp.send('planUltimoDia', owner.phone, {
            body: [who, plan.name, business.name],
            buttons: button,
          })) || ok;
      } else if (daysLeft === 0) {
        ok =
          (await this.whatsapp.send('planVenceHoy', owner.phone, {
            body: [who, plan.name, business.name],
            buttons: button,
          })) || ok;
      } else if (inTrial) {
        if (daysLeft <= 3) {
          // Dos botones: pagar y ver los planes (los dos llevan a "Tu plan").
          ok =
            (await this.whatsapp.send('pruebaPorTerminar', owner.phone, {
              body: [who, plan.name, business.name, when, price],
              buttons: [...button, ...button],
            })) || ok;
        }
      } else {
        ok =
          (await this.whatsapp.send('planPorVencer', owner.phone, {
            body: [who, plan.name, business.name, when, price],
            buttons: button,
          })) || ok;
      }
      const pushed = await this.push.toOwner(
        business.id,
        planReminderPush({
          businessId: business.id,
          businessName: business.name,
          planName: plan.name,
          price,
          daysLeft,
          inTrial,
          lastGraceDay,
          downgraded,
        }),
      );
      ok = pushed > 0 || ok;
      if (ok) sent++;
      else await this.ttl.delete(key);
    }
    return sent;
  }

  private async sendReceipt(business: Business, payment: PlanPayment) {
    const owner = await this.ownerContact(business);
    const paidUntil = (payment.periodEnd ?? new Date()).toLocaleDateString(
      'es-CO',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
      },
    );
    await this.push.toOwner(business.id, {
      title: 'Recibimos tu pago',
      body: `El plan ${planDefinition(payment.plan).name} de ${business.name} quedó pagado hasta el ${paidUntil}.`,
      url: PLAN_PATH,
      tag: `plan-${business.id}`,
    });
    await this.whatsapp.send('pagoRecibido', owner?.phone, {
      body: [
        firstName(owner?.name ?? payment.billing.fullName),
        cop(payment.amountInCents / 100),
        planDefinition(payment.plan).name,
        business.name,
        paidUntil,
        payment.reference,
      ],
      buttons: [
        {
          url: storeUrl(this.config, business.slug, '/configuracion/plan'),
          days: 60,
        },
      ],
    });
    const to = { name: payment.billing.fullName, email: payment.billing.email };
    await this.mail.sendPaymentReceipt(to, {
      name: to.name,
      businessName: business.name,
      planName: planDefinition(payment.plan).name,
      amount: money(payment.amountInCents),
      paidUntil: (payment.periodEnd ?? new Date()).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }),
      reference: payment.reference,
      logoUrl: this.mail.logoUrl(),
    });
  }

  /** El pago no se aprobó: aviso por WhatsApp con el botón para intentarlo otra vez. */
  private async notifyDeclined(payment: PlanPayment) {
    const business = await this.businesses.findOneBy({
      id: payment.businessId,
    });
    if (!business) return;
    await this.push.toOwner(business.id, {
      title: 'Tu pago no se aprobó',
      body: `El pago del plan ${planDefinition(payment.plan).name} de ${business.name} no se aprobó y no se te cobró nada. Toca para intentarlo otra vez.`,
      url: PLAN_PATH,
      tag: `plan-${business.id}`,
    });
    const owner = await this.ownerContact(business);
    await this.whatsapp.send('pagoRechazado', owner?.phone, {
      body: [
        firstName(owner?.name ?? payment.billing.fullName),
        planDefinition(payment.plan).name,
        business.name,
      ],
      buttons: [
        {
          url: storeUrl(this.config, business.slug, '/configuracion/plan'),
          days: 30,
        },
      ],
    });
  }

  /** Nombre, correo (o el de facturación) y WhatsApp del dueño. */
  private async ownerContact(business: Business): Promise<{
    name: string;
    email: string | null;
    phone: string | null;
  } | null> {
    const owner = await this.members.findOne({
      where: { businessId: business.id, role: BusinessRole.Owner },
      relations: { user: true },
    });
    const email = owner?.user.email ?? business.billingProfile?.email ?? null;
    const phone = owner?.user.phone ?? null;
    if (!email && !phone) return null;
    return {
      name:
        owner?.user.name ?? business.billingProfile?.fullName ?? business.name,
      email,
      phone,
    };
  }

  /** Solo se vuelve a una tienda nuestra (evita redirecciones abiertas). */
  private assertOwnUrl(value: string) {
    const root = new URL(
      this.config.get<string>('APP_URL', 'http://localhost:3001'),
    ).hostname;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('La dirección de regreso no es válida.');
    }
    const localDev = root === 'localhost' && url.protocol === 'http:';
    if (
      (url.protocol !== 'https:' && !localDev) ||
      !url.hostname.endsWith(`.${root}`)
    ) {
      throw new BadRequestException('La dirección de regreso no es válida.');
    }
  }
}
