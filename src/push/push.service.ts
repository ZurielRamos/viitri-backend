import { createECDH } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { BusinessProfile } from '../businesses/entities/business-profile.entity.js';
import type { Business } from '../businesses/entities/business.entity.js';
import type { PushSubscriptionDto } from './dto/push.dto.js';
import { PushDevice } from './push-device.entity.js';

/** Lo que ve la persona en la notificación. `url` es una ruta de la tienda. */
export interface PushMessage {
  title: string;
  body: string;
  /** Ruta dentro de la tienda (`/configuracion/pedidos/…`); al tocarla se abre. */
  url: string;
  /** Una notificación con la misma etiqueta reemplaza a la anterior (el mismo pedido). */
  tag?: string;
  /** Ícono de la tienda; sin él, el de viitri. */
  icon?: string;
}

/** Cuánto espera el servicio de push a un celular apagado y con qué prioridad. */
export interface PushDelivery {
  ttlSeconds: number;
  urgency: 'normal' | 'high';
}

/** Pedidos y reservas: urgentes, y pasada una hora ya no sirven. */
const ORDER_DELIVERY: PushDelivery = { ttlSeconds: 60 * 60, urgency: 'high' };
/** Avisos del plan y pagos: pueden esperar a que el celular se prenda (hasta un día). */
export const ACCOUNT_DELIVERY: PushDelivery = {
  ttlSeconds: 24 * 60 * 60,
  urgency: 'normal',
};

/** Envía un mensaje cifrado al servicio de push del navegador. */
export type WebPushSend = typeof webpush.sendNotification;
export const WEB_PUSH_SEND = Symbol('WEB_PUSH_SEND');

/**
 * Solo se envía a los servicios de push de los navegadores: el `endpoint`
 * lo manda el navegador, y sin esta lista la API haría peticiones a cualquier
 * dirección que alguien le pase.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' &&
      !url.port &&
      PUSH_HOSTS.some((host) => host.test(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

/**
 * Si la clave privada VAPID corresponde a la pública. Si no, los servicios de
 * push rechazan cada envío (401/403) aunque el celular se suscriba de nuevo.
 */
export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKey.trim(), 'base64url'));
    const derived = ecdh.getPublicKey().toString('base64url');
    return derived === publicKey.trim().replace(/=+$/, '');
  } catch {
    return false;
  }
}

/** Ícono de la app de la tienda (lo crea la API al subir el logo, como en el manifiesto). */
export function storeIcon(business: Pick<Business, 'profile'>): string {
  const logo = business.profile?.logoUrl;
  return logo
    ? logo.replace(/\.webp$/, '-icon-192.png')
    : '/icons/viitri-192.png';
}

/**
 * Notificaciones push (Web Push con VAPID, sin Firebase). Sin las claves
 * VAPID no se envía nada: cada aviso se escribe en el log. Nunca lanza: un
 * aviso que falla no frena el pedido ni la reserva.
 */
interface Vapid {
  subject: string;
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  /** Claves vigentes; se recalculan cuando cambian desde el panel. */
  private cached: {
    signature: string;
    vapid: Vapid | null;
    keysMismatch: boolean;
  } | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PushDevice)
    private readonly devices: Repository<PushDevice>,
    @Inject(WEB_PUSH_SEND) private readonly sendFn: WebPushSend,
    @InjectRepository(BusinessProfile)
    private readonly profiles: Repository<BusinessProfile>,
  ) {
    this.keys();
  }

  private keys() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('VAPID_SUBJECT') || 'mailto:soporte@viitri.com';
    const signature = `${publicKey}|${privateKey}|${subject}`;
    if (this.cached?.signature !== signature) {
      const keysMismatch = Boolean(
        publicKey && privateKey && !vapidKeysMatch(publicKey, privateKey),
      );
      if (keysMismatch) {
        this.logger.error(
          'VAPID_PRIVATE_KEY no corresponde a VAPID_PUBLIC_KEY: ningún aviso push va a llegar. Genera un par nuevo con `npx web-push generate-vapid-keys` y pon las dos claves juntas.',
        );
      }
      this.cached = {
        signature,
        vapid:
          publicKey && privateKey ? { subject, publicKey, privateKey } : null,
        keysMismatch,
      };
    }
    return this.cached;
  }

  private get vapid(): Vapid | null {
    return this.keys().vapid;
  }

  /** La clave privada no es la pareja de la pública (mal configuradas). */
  private get keysMismatch(): boolean {
    return this.keys().keysMismatch;
  }

  /** Clave pública para `pushManager.subscribe`. Sin claves, `null` (la web no ofrece los avisos). */
  publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  /**
   * Guarda el celular para alguien del equipo o para un cliente. El mismo
   * celular en la misma tienda conserva a quien ya tenía (atender y pedir
   * desde el mismo teléfono).
   */
  async register(
    businessId: string,
    subscription: PushSubscriptionDto,
    owner: { userId: string } | { customerId: string },
  ): Promise<boolean> {
    if (!isPushEndpoint(subscription.endpoint)) return false;
    const existing = await this.devices.findOneBy({
      endpoint: subscription.endpoint,
    });
    // Otra tienda con el mismo endpoint no debería pasar (cada subdominio es
    // otro origen); si pasa, el celular pasa a esta tienda desde cero.
    const keep = existing?.businessId === businessId ? existing : null;
    const device = this.devices.create({
      ...(existing && { id: existing.id }),
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      businessId,
      userId: 'userId' in owner ? owner.userId : (keep?.userId ?? null),
      customerId:
        'customerId' in owner ? owner.customerId : (keep?.customerId ?? null),
    });
    await this.devices.save(device);
    return true;
  }

  /** Deja de avisarle en este celular a esa persona (al cerrar sesión o desactivarlos). */
  async unregister(
    endpoint: string,
    who: { userId: string } | { customerId: string },
  ): Promise<void> {
    const device = await this.devices.findOneBy({ endpoint });
    if (!device) return;
    if ('userId' in who && device.userId === who.userId) device.userId = null;
    else if ('customerId' in who && device.customerId === who.customerId)
      device.customerId = null;
    else return;
    if (!device.userId && !device.customerId) await this.devices.remove(device);
    else await this.devices.save(device);
  }

  /**
   * Envía un aviso de prueba a este celular y dice qué pasó, para que la
   * persona confirme que le llegan (y para ver por qué no, sin revisar logs).
   */
  async test(
    endpoint: string,
    userId: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const device = await this.devices.findOneBy({ endpoint, userId });
    if (!device)
      return {
        sent: false,
        error: 'Este celular no tiene los avisos activos.',
      };
    if (!this.vapid)
      return {
        sent: false,
        error: 'Las notificaciones no están configuradas en el servidor.',
      };
    if (this.keysMismatch)
      return {
        sent: false,
        error:
          'En el servidor, la clave privada de notificaciones (VAPID_PRIVATE_KEY) no corresponde a la pública (VAPID_PUBLIC_KEY). Hay que poner las dos del mismo par.',
      };
    try {
      await this.sendFn(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth },
        },
        JSON.stringify({
          title: 'Así te avisaremos',
          body: 'Cuando llegue un pedido o una reserva, verás un aviso como este.',
          url: '/configuracion/pedidos',
          tag: 'push-test',
          icon: await this.iconFor(device.businessId),
        } satisfies PushMessage),
        { vapidDetails: this.vapid, TTL: 60, urgency: 'high', timeout: 10_000 },
      );
      return { sent: true };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const body = String((error as { body?: string }).body ?? error).slice(
        0,
        200,
      );
      this.logger.warn(`Push de prueba: ${status ?? ''} ${body}`);
      if (status === 404 || status === 410) {
        await this.devices.delete({ id: device.id });
        return {
          sent: false,
          error: 'Este celular dio de baja los avisos. Vuelve a activarlos.',
        };
      }
      return {
        sent: false,
        error:
          status === 401 || status === 403
            ? 'Las claves de notificaciones del servidor no coinciden con las de este celular. Desactiva y vuelve a activar los avisos.'
            : `El servicio de notificaciones respondió ${status ?? 'con un error'}: ${body}`,
      };
    }
  }

  /** Si este celular tiene los avisos activos para esa persona. */
  async isRegistered(
    endpoint: string,
    who: { userId: string } | { customerId: string },
  ): Promise<boolean> {
    return this.devices.existsBy({
      endpoint,
      ...('userId' in who
        ? { userId: who.userId }
        : { customerId: who.customerId }),
    });
  }

  /**
   * Al equipo del negocio que tiene activos los avisos de pedidos y reservas
   * (el dueño lo configura por colaborador). `exceptUserId`: quien hizo el
   * cambio no necesita enterarse.
   */
  async toStaff(
    businessId: string,
    message: PushMessage,
    exceptUserId?: string | null,
  ): Promise<number> {
    try {
      const query = this.devices
        .createQueryBuilder('device')
        .innerJoin(
          'business_members',
          'member',
          'member.business_id = device.businessId AND member.user_id = device.userId',
        )
        .where('device.businessId = :businessId', { businessId })
        .andWhere('member.notify_orders = true');
      if (exceptUserId)
        query.andWhere('device.userId <> :exceptUserId', { exceptUserId });
      return await this.deliver(await query.getMany(), message, ORDER_DELIVERY);
    } catch (error) {
      this.logger.warn(`Push al equipo de ${businessId}: ${String(error)}`);
      return 0;
    }
  }

  /** A los celulares del cliente en esta tienda. */
  async toCustomer(
    customerId: string | null | undefined,
    message: PushMessage,
  ): Promise<number> {
    if (!customerId) return 0;
    try {
      return await this.deliver(
        await this.devices.findBy({ customerId }),
        message,
        ORDER_DELIVERY,
      );
    } catch (error) {
      this.logger.warn(`Push al cliente ${customerId}: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Al dueño del negocio, en los celulares donde entró a su tienda: avisos de
   * su plan y sus pagos. No depende del interruptor de pedidos y reservas.
   */
  async toOwner(
    businessId: string,
    message: PushMessage,
    delivery: PushDelivery = ACCOUNT_DELIVERY,
  ): Promise<number> {
    try {
      const devices = await this.devices
        .createQueryBuilder('device')
        .innerJoin(
          'business_members',
          'member',
          'member.business_id = device.businessId AND member.user_id = device.userId',
        )
        .where('device.businessId = :businessId', { businessId })
        .andWhere(`member.role = 'owner'`)
        .getMany();
      return await this.deliver(devices, message, delivery);
    } catch (error) {
      this.logger.warn(`Push al dueño de ${businessId}: ${String(error)}`);
      return 0;
    }
  }

  /** Ícono del negocio para el aviso: el de su app, o el de viitri si no tiene logo. */
  private async iconFor(businessId: string): Promise<string> {
    const profile = await this.profiles
      .findOne({
        where: { businessId },
        select: { businessId: true, logoUrl: true },
      })
      .catch(() => null);
    return storeIcon({ profile } as Pick<Business, 'profile'>);
  }

  private async deliver(
    devices: PushDevice[],
    message: PushMessage,
    { ttlSeconds, urgency }: PushDelivery,
  ): Promise<number> {
    if (!devices.length) return 0;
    // Siempre con el logo del negocio (los avisos del plan no lo traen).
    const payload = JSON.stringify({
      ...message,
      icon: message.icon ?? (await this.iconFor(devices[0].businessId)),
    });
    if (!this.vapid) {
      // Sin claves VAPID (desarrollo): se escribe en el log.
      this.logger.log(`[Push → ${devices.length} celular(es)] ${payload}`);
      return devices.length;
    }
    let sent = 0;
    await Promise.all(
      devices.map(async (device) => {
        try {
          await this.sendFn(
            {
              endpoint: device.endpoint,
              keys: { p256dh: device.p256dh, auth: device.auth },
            },
            payload,
            {
              vapidDetails: this.vapid!,
              TTL: ttlSeconds,
              urgency,
              timeout: 10_000,
            },
          );
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404 y 410: el navegador ya no tiene esa suscripción.
          if (status === 404 || status === 410) {
            await this.devices.delete({ id: device.id });
            return;
          }
          this.logger.warn(
            `Push a ${new URL(device.endpoint).hostname}: ${status ?? String(error)}`,
          );
        }
      }),
    );
    return sent;
  }
}
