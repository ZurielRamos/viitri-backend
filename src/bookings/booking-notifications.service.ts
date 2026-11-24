import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import { storeUrl } from '../common/store-url.js';
import {
  WhatsappNotificationsService,
  firstName,
  longDay,
  shortTime,
} from '../notifications/whatsapp/whatsapp-notifications.service.js';
import { PushService, storeIcon } from '../push/push.service.js';
import { BookingKind, BookingSource, BookingStatus } from './booking.enums.js';
import { Booking } from './entities/booking.entity.js';

/** El recordatorio sale entre 2½ y 3½ horas antes (la tarea corre cada hora). */
const REMINDER_FROM_MS = 2.5 * 3_600_000;
const REMINDER_TO_MS = 3.5 * 3_600_000;

/**
 * Avisos de las reservas de mesa (Pro). Push: al equipo cuando llega una o el
 * cliente la cancela, y al cliente cuando se confirma, se cancela y el mismo
 * día. WhatsApp: al dueño cuando llega una que pide confirmarse, al cliente
 * cuando queda confirmada y el mismo día, unas horas antes. Nunca lanzan.
 */
@Injectable()
export class BookingNotificationsService {
  private readonly logger = new Logger(BookingNotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly whatsapp: WhatsappNotificationsService,
    private readonly push: PushService,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {}

  /** Llegó una reserva de mesa: enlace de seguimiento para el cliente y el aviso que corresponda. */
  async created(
    business: Business,
    booking: Booking,
    trackingToken: string,
  ): Promise<void> {
    if (
      booking.kind !== BookingKind.Table ||
      booking.source !== BookingSource.Customer
    )
      return;
    try {
      const code = await this.whatsapp.link(
        storeUrl(this.config, business.slug, `/cita/${trackingToken}`),
        Math.max(
          7,
          Math.ceil((booking.startsAt.getTime() - Date.now()) / 86_400_000) + 2,
        ),
      );
      await this.bookings.update(
        { id: booking.id },
        { trackingLinkCode: code },
      );
      booking.trackingLinkCode = code;
      const fresh = booking;
      const store = business.profile
        ? business
        : ((await this.business(business.id)) ?? business);
      await this.push.toStaff(business.id, {
        title:
          booking.status === BookingStatus.Pending
            ? 'Reserva nueva por confirmar'
            : 'Reserva nueva',
        body: `${booking.contactName} · ${this.when(store, booking)}`,
        url: `/configuracion/citas/${booking.id}`,
        tag: `booking-${booking.id}`,
        icon: storeIcon(store),
      });
      if (booking.status === BookingStatus.Pending)
        await this.notifyOwner(business, fresh);
      else if (booking.status === BookingStatus.Confirmed)
        await this.confirmed(fresh, business);
    } catch (error) {
      this.logger.warn(`Aviso de la reserva ${booking.id}: ${String(error)}`);
    }
  }

  /** La reserva cambió de estado: al confirmarse o cancelarse, se le avisa al cliente. */
  async statusChanged(booking: Booking): Promise<void> {
    if (booking.kind !== BookingKind.Table) return;
    try {
      if (booking.status === BookingStatus.Confirmed)
        await this.confirmed(booking);
      else if (booking.status === BookingStatus.Cancelled) {
        const business = await this.business(booking.businessId);
        if (!business) return;
        const reason = booking.cancelReason?.trim();
        await this.push.toCustomer(booking.customerId, {
          title: 'Tu reserva fue cancelada',
          body: `${business.name} canceló tu reserva del ${this.when(business, booking)}${reason ? `: ${reason}` : '.'}`,
          url: '/mis-citas',
          tag: `booking-${booking.id}`,
          icon: storeIcon(business),
        });
      }
    } catch (error) {
      this.logger.warn(`Aviso de la reserva ${booking.id}: ${String(error)}`);
    }
  }

  /** El cliente canceló su reserva: el equipo libera la mesa. */
  async cancelledByCustomer(booking: Booking): Promise<void> {
    if (booking.kind !== BookingKind.Table) return;
    try {
      const business = await this.business(booking.businessId);
      if (!business) return;
      await this.push.toStaff(business.id, {
        title: 'Reserva cancelada',
        body: `${booking.contactName} canceló su reserva del ${this.when(business, booking)}.`,
        url: `/configuracion/citas/${booking.id}`,
        tag: `booking-${booking.id}`,
        icon: storeIcon(business),
      });
    } catch (error) {
      this.logger.warn(`Aviso de la reserva ${booking.id}: ${String(error)}`);
    }
  }

  /** "sábado 12 de diciembre, 8:00 p. m. · 4 personas" */
  private when(business: Business, booking: Booking): string {
    const zone = business.profile?.timezone || 'America/Bogota';
    const people = booking.partySize ?? 1;
    return `${longDay(booking.startsAt, zone)}, ${shortTime(booking.startsAt, zone)} · ${people === 1 ? '1 persona' : `${people} personas`}`;
  }

  /** Cada hora: recordatorio a las reservas confirmadas que empiezan en unas 3 horas. */
  @Cron(CronExpression.EVERY_HOUR)
  async remind(now = new Date()): Promise<void> {
    try {
      const result: unknown = await this.dataSource.query(
        `UPDATE "bookings" SET "reminded_at" = now()
          WHERE "kind" = 'table' AND "status" = 'confirmed' AND "reminded_at" IS NULL
            AND "tracking_link_code" IS NOT NULL
            AND "starts_at" >= $1 AND "starts_at" < $2
          RETURNING "id"`,
        [
          new Date(now.getTime() + REMINDER_FROM_MS),
          new Date(now.getTime() + REMINDER_TO_MS),
        ],
      );
      const rows = (
        Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
      ) as { id: string }[];
      for (const { id } of rows) {
        const booking = await this.bookings.findOneBy({ id });
        if (!booking?.trackingLinkCode) continue;
        const business = await this.business(booking.businessId);
        if (!business) continue;
        const zone = business.profile?.timezone || 'America/Bogota';
        await this.push.toCustomer(booking.customerId, {
          title: 'Hoy tienes una reserva',
          body: `Te esperamos a las ${shortTime(booking.startsAt, zone)} en ${business.name}.`,
          url: '/mis-citas',
          tag: `booking-${booking.id}`,
          icon: storeIcon(business),
        });
        await this.whatsapp.send('reservaRecordatorio', booking.contactPhone, {
          body: [
            firstName(booking.contactName),
            shortTime(booking.startsAt, zone),
            business.name,
            String(booking.partySize ?? 1),
          ],
          buttons: [{ code: booking.trackingLinkCode }],
        });
      }
    } catch (error) {
      this.logger.error('Falló el recordatorio de reservas', error as Error);
    }
  }

  private async confirmed(booking: Booking, known?: Business) {
    if (!booking.trackingLinkCode) return;
    const business = known?.profile
      ? known
      : await this.business(booking.businessId);
    if (!business) return;
    const zone = business.profile?.timezone || 'America/Bogota';
    await this.push.toCustomer(booking.customerId, {
      title: 'Reserva confirmada',
      body: `${business.name} confirmó tu reserva: ${this.when(business, booking)}.`,
      url: '/mis-citas',
      tag: `booking-${booking.id}`,
      icon: storeIcon(business),
    });
    await this.whatsapp.send('reservaConfirmada', booking.contactPhone, {
      body: [
        firstName(booking.contactName),
        business.name,
        String(booking.partySize ?? 1),
        longDay(booking.startsAt, zone),
        shortTime(booking.startsAt, zone),
      ],
      buttons: [{ code: booking.trackingLinkCode }],
    });
  }

  private async notifyOwner(business: Business, booking: Booking) {
    const owner = await this.members.findOne({
      where: { businessId: business.id, role: BusinessRole.Owner },
      relations: { user: true },
    });
    if (!owner?.user.phone) return;
    const zone = business.profile?.timezone || 'America/Bogota';
    await this.whatsapp.send('reservaNueva', owner.user.phone, {
      body: [
        business.name,
        String(booking.partySize ?? 1),
        longDay(booking.startsAt, zone),
        shortTime(booking.startsAt, zone),
        booking.contactName,
      ],
      buttons: [
        {
          url: storeUrl(
            this.config,
            business.slug,
            `/configuracion/citas/${booking.id}`,
          ),
          days: 14,
        },
      ],
    });
  }

  private business(id: string) {
    return this.businesses.findOne({
      where: { id },
      relations: { profile: true },
    });
  }
}
