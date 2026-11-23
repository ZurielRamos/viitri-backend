import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  Between,
  DataSource,
  In,
  LessThan,
  MoreThan,
  type EntityManager,
  type FindOptionsWhere,
  Repository,
} from 'typeorm';
import type { Business } from '../businesses/entities/business.entity.js';
import { findOpeningHoursError } from '../businesses/profile/opening-hours.js';
import { ItemKind, PriceType } from '../catalog/catalog.enums.js';
import { Item } from '../catalog/entities/item.entity.js';
import { lowestPrice } from '../catalog/items.service.js';
import { Customer } from '../customers/entities/customer.entity.js';
import {
  addDays,
  localDate,
  slotsFor,
  zonedInstant,
  type ResourceId,
  type Slot,
} from './availability.js';
import { hoursOn } from '../businesses/profile/open-status.js';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  BookingKind,
  BookingSource,
  BookingStatus,
} from './booking.enums.js';
import type {
  CreateBookingDto,
  CreateTableReservationDto,
  ListBookingsQueryDto,
  ProfessionalInputDto,
  UpdateBookingSettingsDto,
} from './dto/booking.dto.js';
import { BookingSettings } from './entities/booking-settings.entity.js';
import { Booking } from './entities/booking.entity.js';
import { Professional } from './entities/professional.entity.js';

const MINUTE = 60_000;
/** Sin profesionales, el negocio atiende una cita a la vez. */
const BUSINESS: ResourceId = '';
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export interface BookingContact {
  /** Cliente con sesión: la cita es suya. */
  customer?: Customer | null;
  /** El personal agenda por alguien: se busca el cliente por teléfono. */
  matchExisting?: boolean;
}

export interface Availability {
  date: string | null;
  timezone: string;
  /** Fechas con algún horario libre, de hoy al máximo de días permitido. */
  days: string[];
  slots: { startsAt: string; professionalIds: string[] }[];
  professionals: { id: string; name: string }[];
  service: {
    id: string;
    name: string;
    slug: string;
    durationMinutes: number;
    priceType: PriceType;
    price: number;
  };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(BookingSettings)
    private readonly settingsRepo: Repository<BookingSettings>,
    @InjectRepository(Professional)
    private readonly professionals: Repository<Professional>,
    @InjectRepository(Item)
    private readonly items: Repository<Item>,
  ) {}

  // ---------- Ajustes ----------

  async getSettings(businessId: string): Promise<BookingSettings> {
    return (
      (await this.settingsRepo.findOne({ where: { businessId } })) ??
      this.settingsRepo.create({
        businessId,
        slotIntervalMinutes: 30,
        minNoticeMinutes: 60,
        maxDaysAhead: 30,
        requiresApproval: false,
        useBusinessHours: true,
        hours: [],
        reservationDurationMinutes: 90,
        reservationsPerSlot: 5,
        maxPartySize: 10,
      })
    );
  }

  async updateSettings(
    businessId: string,
    dto: UpdateBookingSettingsDto,
  ): Promise<BookingSettings> {
    if (dto.hours) {
      const error = findOpeningHoursError(dto.hours);
      if (error) throw new BadRequestException(error);
    }
    const current = await this.getSettings(businessId);
    Object.assign(
      current,
      Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    );
    return this.settingsRepo.save(current);
  }

  // ---------- Profesionales ----------

  listProfessionals(businessId: string): Promise<Professional[]> {
    return this.professionals.find({
      where: { businessId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createProfessional(
    businessId: string,
    dto: ProfessionalInputDto,
  ): Promise<Professional> {
    await this.assertServices(businessId, dto.serviceIds ?? []);
    const last = await this.professionals.findOne({
      where: { businessId },
      order: { sortOrder: 'DESC' },
    });
    return this.professionals.save(
      this.professionals.create({
        businessId,
        name: dto.name,
        serviceIds: dto.serviceIds ?? [],
        isActive: dto.isActive ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      }),
    );
  }

  async updateProfessional(
    businessId: string,
    id: string,
    dto: ProfessionalInputDto,
  ): Promise<Professional> {
    const professional = await this.professionals.findOne({
      where: { id, businessId },
    });
    if (!professional)
      throw new NotFoundException('Profesional no encontrado.');
    if (dto.serviceIds) await this.assertServices(businessId, dto.serviceIds);
    professional.name = dto.name;
    if (dto.serviceIds) professional.serviceIds = dto.serviceIds;
    if (dto.isActive !== undefined) professional.isActive = dto.isActive;
    return this.professionals.save(professional);
  }

  /** Sus citas se conservan, con su nombre. */
  async removeProfessional(businessId: string, id: string): Promise<void> {
    const { affected } = await this.professionals.delete({ id, businessId });
    if (!affected) throw new NotFoundException('Profesional no encontrado.');
  }

  // ---------- Disponibilidad ----------

  /** Horarios libres de un servicio en una fecha, y las fechas que tienen alguno. */
  async availability(
    business: Business,
    itemId: string,
    query: { date?: string; professionalId?: string },
  ): Promise<Availability> {
    const service = await this.findService(business.id, itemId);
    const settings = await this.getSettings(business.id);
    const timezone = business.profile.timezone || 'UTC';
    const team = await this.teamFor(business.id, service.id);
    const professionalIds = query.professionalId
      ? team.filter((p) => p.id === query.professionalId).map((p) => p.id)
      : null;
    if (query.professionalId && !professionalIds?.length) {
      throw new BadRequestException('Ese profesional no hace este servicio.');
    }
    const now = new Date();
    const today = localDate(now, timezone);
    const last = addDays(today, settings.maxDaysAhead);
    const busy = await this.busyMap(
      business.id,
      today,
      last,
      timezone,
      BookingKind.Service,
    );
    const compute = (date: string) =>
      this.slots(business, service, settings, team, busy, date, {
        earliest: new Date(now.getTime() + settings.minNoticeMinutes * MINUTE),
        only: professionalIds,
      });
    const days: string[] = [];
    for (let date = today; date <= last; date = addDays(date, 1)) {
      if (compute(date).length) days.push(date);
    }
    const date = query.date ?? days[0] ?? null;
    const slots = date && date >= today && date <= last ? compute(date) : [];
    return {
      date,
      timezone,
      days,
      slots: slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        professionalIds: s.resources.filter((r) => r !== BUSINESS),
      })),
      professionals: team.map((p) => ({ id: p.id, name: p.name })),
      service: {
        id: service.id,
        name: service.name,
        slug: service.slug,
        durationMinutes: service.service!.durationMinutes,
        priceType: service.priceType,
        price: lowestPrice(service.variants),
      },
    };
  }

  // ---------- Citas ----------

  /**
   * Agenda una cita en uno de los horarios libres. El negocio se bloquea
   * mientras tanto: dos clientes no pueden tomar el mismo horario.
   */
  async create(params: {
    business: Business;
    dto: CreateBookingDto;
    source: BookingSource;
    contact: BookingContact;
  }): Promise<{ booking: Booking; trackingToken: string }> {
    const { business, dto, source, contact } = params;
    const service = await this.findService(business.id, dto.itemId);
    const settings = await this.getSettings(business.id);
    const timezone = business.profile.timezone || 'UTC';
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Revisa la hora de la cita.');
    }
    const date = localDate(startsAt, timezone);
    const trackingToken = randomBytes(24).toString('base64url');
    const id = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT 1 FROM "businesses" WHERE "id" = $1 FOR UPDATE`,
        [business.id],
      );
      const team = await this.teamFor(business.id, service.id, manager);
      const busy = await this.busyMap(
        business.id,
        date,
        date,
        timezone,
        BookingKind.Service,
        manager,
      );
      const now = new Date();
      // El personal puede agendar para ya mismo; el cliente, con la anticipación pedida.
      const notice =
        source === BookingSource.Staff ? 0 : settings.minNoticeMinutes;
      const slot = this.slots(business, service, settings, team, busy, date, {
        earliest: new Date(now.getTime() + notice * MINUTE),
        only: dto.professionalId ? [dto.professionalId] : null,
      }).find((s) => s.startsAt.getTime() === startsAt.getTime());
      const today = localDate(now, timezone);
      if (!slot || date > addDays(today, settings.maxDaysAhead)) {
        throw new ConflictException(
          'Ese horario ya no está disponible. Elige otro.',
        );
      }
      const resource = slot.resources[0];
      const professional = team.find((p) => p.id === resource) ?? null;
      const customerId = await this.resolveCustomer(
        manager,
        business.id,
        dto,
        contact,
      );
      const durationMs = service.service!.durationMinutes * MINUTE;
      const bufferMs = service.service!.bufferMinutes * MINUTE;
      const number = await this.nextNumber(manager, business.id);
      const saved = await manager.save(
        manager.create(Booking, {
          businessId: business.id,
          number,
          status:
            source === BookingSource.Customer && settings.requiresApproval
              ? BookingStatus.Pending
              : BookingStatus.Confirmed,
          source,
          itemId: service.id,
          serviceName: service.name,
          durationMinutes: service.service!.durationMinutes,
          bufferMinutes: service.service!.bufferMinutes,
          priceType: service.priceType,
          price: lowestPrice(service.variants),
          currency: business.profile.currency,
          professionalId: professional?.id ?? null,
          professionalName: professional?.name ?? null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMs),
          blockedUntil: new Date(startsAt.getTime() + durationMs + bufferMs),
          customerId,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          notes: dto.notes || null,
          trackingTokenHash: hashToken(trackingToken),
        }),
      );
      return saved.id;
    });
    return {
      booking: await this.findOneOrFail(business.id, id),
      trackingToken,
    };
  }

  /** Días y horas libres para reservar mesa, de hoy al máximo de días. */
  async tableAvailability(business: Business, query: { date?: string }) {
    const settings = await this.getSettings(business.id);
    const timezone = business.profile.timezone || 'UTC';
    const now = new Date();
    const today = localDate(now, timezone);
    const last = addDays(today, settings.maxDaysAhead);
    const taken = await this.busyMap(
      business.id,
      today,
      last,
      timezone,
      BookingKind.Table,
    );
    const earliest = new Date(
      now.getTime() + settings.minNoticeMinutes * MINUTE,
    );
    const compute = (date: string) =>
      this.tableSlots(business, settings, taken, date, earliest);
    const days: string[] = [];
    for (let date = today; date <= last; date = addDays(date, 1)) {
      if (compute(date).length) days.push(date);
    }
    const date = query.date ?? days[0] ?? null;
    const slots = date && date >= today && date <= last ? compute(date) : [];
    return {
      date,
      timezone,
      days,
      slots: slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        professionalIds: [],
      })),
      maxPartySize: settings.maxPartySize,
      durationMinutes: settings.reservationDurationMinutes,
    };
  }

  /** Reserva una mesa en uno de los horarios libres (con el negocio bloqueado). */
  async createTableReservation(params: {
    business: Business;
    dto: CreateTableReservationDto;
    source: BookingSource;
    contact: BookingContact;
  }): Promise<{ booking: Booking; trackingToken: string }> {
    const { business, dto, source, contact } = params;
    const settings = await this.getSettings(business.id);
    if (
      source === BookingSource.Customer &&
      dto.partySize > settings.maxPartySize
    ) {
      throw new BadRequestException(
        `Para más de ${settings.maxPartySize} personas, escríbele al negocio.`,
      );
    }
    const timezone = business.profile.timezone || 'UTC';
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Revisa la hora de la reserva.');
    }
    const date = localDate(startsAt, timezone);
    const trackingToken = randomBytes(24).toString('base64url');
    const id = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT 1 FROM "businesses" WHERE "id" = $1 FOR UPDATE`,
        [business.id],
      );
      const taken = await this.busyMap(
        business.id,
        date,
        date,
        timezone,
        BookingKind.Table,
        manager,
      );
      const now = new Date();
      const notice =
        source === BookingSource.Staff ? 0 : settings.minNoticeMinutes;
      const slot = this.tableSlots(
        business,
        settings,
        taken,
        date,
        new Date(now.getTime() + notice * MINUTE),
      ).find((s) => s.startsAt.getTime() === startsAt.getTime());
      if (
        !slot ||
        date > addDays(localDate(now, timezone), settings.maxDaysAhead)
      ) {
        throw new ConflictException(
          'Ese horario ya no está disponible. Elige otro.',
        );
      }
      const customerId = await this.resolveCustomer(
        manager,
        business.id,
        dto,
        contact,
      );
      const durationMs = settings.reservationDurationMinutes * MINUTE;
      const number = await this.nextNumber(manager, business.id);
      const saved = await manager.save(
        manager.create(Booking, {
          businessId: business.id,
          number,
          kind: BookingKind.Table,
          partySize: dto.partySize,
          status:
            source === BookingSource.Customer && settings.requiresApproval
              ? BookingStatus.Pending
              : BookingStatus.Confirmed,
          source,
          itemId: null,
          serviceName: 'Reserva de mesa',
          durationMinutes: settings.reservationDurationMinutes,
          bufferMinutes: 0,
          priceType: PriceType.Free,
          price: 0,
          currency: business.profile.currency,
          professionalId: null,
          professionalName: null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMs),
          blockedUntil: new Date(startsAt.getTime() + durationMs),
          customerId,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          notes: dto.notes || null,
          trackingTokenHash: hashToken(trackingToken),
        }),
      );
      return saved.id;
    });
    return {
      booking: await this.findOneOrFail(business.id, id),
      trackingToken,
    };
  }

  async findOneOrFail(businessId: string, id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id, businessId } });
    if (!booking) throw new NotFoundException('Cita no encontrada.');
    return booking;
  }

  async findByTrackingToken(
    businessId: string,
    token: string,
  ): Promise<Booking> {
    const booking = await this.bookings.findOne({
      where: { businessId, trackingTokenHash: hashToken(token) },
    });
    if (!booking) throw new NotFoundException('Cita no encontrada.');
    return booking;
  }

  /** Citas por fecha (de la más próxima a la más lejana) o de un cliente. */
  async list(
    business: Business,
    query: ListBookingsQueryDto,
  ): Promise<Booking[]> {
    const where: FindOptionsWhere<Booking> = { businessId: business.id };
    if (query.status?.length) where.status = In(query.status);
    if (query.customerId) {
      where.customerId = query.customerId;
      return this.bookings.find({
        where,
        order: { startsAt: 'DESC' },
        take: 200,
      });
    }
    const timezone = business.profile.timezone || 'UTC';
    const from = query.from ?? localDate(new Date(), timezone);
    const to = query.to ?? addDays(from, 30);
    where.startsAt = Between(
      zonedInstant(from, 0, timezone),
      zonedInstant(addDays(to, 1), 0, timezone),
    );
    return this.bookings.find({ where, order: { startsAt: 'ASC' }, take: 500 });
  }

  async updateStatus(
    businessId: string,
    id: string,
    status: BookingStatus,
    reason?: string,
  ): Promise<Booking> {
    const booking = await this.findOneOrFail(businessId, id);
    if (!BOOKING_TRANSITIONS[booking.status].includes(status)) {
      throw new BadRequestException('La cita ya no puede pasar a ese estado.');
    }
    booking.status = status;
    if (status === BookingStatus.Cancelled)
      booking.cancelReason = reason ?? null;
    return this.bookings.save(booking);
  }

  /** El cliente cancela antes de que empiece. */
  async cancelByCustomer(businessId: string, token: string): Promise<Booking> {
    return this.cancelled(await this.findByTrackingToken(businessId, token));
  }

  /** Citas del cliente con sesión, de la más reciente a la más antigua. */
  listForCustomer(businessId: string, customerId: string): Promise<Booking[]> {
    return this.bookings.find({
      where: { businessId, customerId },
      order: { startsAt: 'DESC' },
      take: 50,
    });
  }

  /** El cliente con sesión cancela una cita suya antes de que empiece. */
  async cancelForCustomer(
    businessId: string,
    customerId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await this.bookings.findOne({
      where: { id, businessId, customerId },
    });
    if (!booking) throw new NotFoundException('Cita no encontrada.');
    return this.cancelled(booking);
  }

  private async cancelled(booking: Booking): Promise<Booking> {
    if (
      !ACTIVE_BOOKING_STATUSES.includes(booking.status) ||
      booking.startsAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Esta cita ya no se puede cancelar.');
    }
    booking.status = BookingStatus.Cancelled;
    booking.cancelReason = 'Cancelada por el cliente.';
    return this.bookings.save(booking);
  }

  // ---------- Internos ----------

  private async findService(businessId: string, itemId: string) {
    const item = await this.items.findOne({
      where: { id: itemId, businessId, kind: ItemKind.Service },
      relations: { service: true, variants: true },
    });
    if (!item?.service) throw new NotFoundException('Servicio no encontrado.');
    if (!item.isActive || !item.isAvailable) {
      throw new ConflictException(
        'Este servicio no está disponible por ahora.',
      );
    }
    return item;
  }

  /** Profesionales activos que hacen el servicio (vacío = hace todos). */
  private async teamFor(
    businessId: string,
    itemId: string,
    manager?: EntityManager,
  ): Promise<Professional[]> {
    const repo = manager?.getRepository(Professional) ?? this.professionals;
    const all = await repo.find({
      where: { businessId, isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return all.filter(
      (p) => !p.serviceIds.length || p.serviceIds.includes(itemId),
    );
  }

  /** Lo ocupado entre esas fechas, por profesional (o del negocio, sin profesional). */
  private async busyMap(
    businessId: string,
    from: string,
    to: string,
    timezone: string,
    kind: BookingKind,
    manager?: EntityManager,
  ): Promise<Booking[]> {
    const repo = manager?.getRepository(Booking) ?? this.bookings;
    return repo.find({
      where: {
        businessId,
        // Las mesas no ocupan a quien atiende servicios, ni al revés.
        kind,
        status: In(ACTIVE_BOOKING_STATUSES),
        startsAt: LessThan(zonedInstant(addDays(to, 1), 0, timezone)),
        blockedUntil: MoreThan(zonedInstant(from, 0, timezone)),
      },
      select: {
        id: true,
        professionalId: true,
        startsAt: true,
        blockedUntil: true,
      },
    });
  }

  private slots(
    business: Business,
    service: Item,
    settings: BookingSettings,
    team: Professional[],
    taken: Booking[],
    date: string,
    options: { earliest: Date; only: string[] | null },
  ): Slot[] {
    const resources = team.length
      ? team
          .map((p) => p.id)
          .filter((id) => !options.only || options.only.includes(id))
      : [BUSINESS];
    const busy = new Map<ResourceId, [number, number][]>();
    for (const booking of taken) {
      // Sin profesionales todo ocupa al negocio; con ellos, cada cita ocupa a quien la atiende.
      const key = team.length ? (booking.professionalId ?? BUSINESS) : BUSINESS;
      const list = busy.get(key) ?? [];
      list.push([booking.startsAt.getTime(), booking.blockedUntil.getTime()]);
      busy.set(key, list);
    }
    return slotsFor({
      date,
      timezone: business.profile.timezone || 'UTC',
      hours: this.hoursFor(business, settings, date),
      durationMinutes: service.service!.durationMinutes,
      bufferMinutes: service.service!.bufferMinutes,
      intervalMinutes: settings.slotIntervalMinutes,
      earliest: options.earliest,
      resources,
      busy,
    });
  }

  /**
   * Tramos de la agenda para una fecha. En festivos vale el horario de
   * festivos de la tienda (vacío: cerrado). El día anterior también cuenta,
   * por si su horario pasa de medianoche.
   */
  private hoursFor(
    business: Business,
    settings: BookingSettings,
    date: string,
  ) {
    const weekly = settings.useBusinessHours
      ? business.profile.openingHours
      : settings.hours;
    const forDay = (day: string) =>
      hoursOn(
        day,
        weekly,
        business.profile.holidayHours ?? [],
        business.profile.countryCode,
      );
    return [...forDay(addDays(date, -1)), ...forDay(date)];
  }

  /**
   * Horarios para reservar mesa: hasta `reservationsPerSlot` reservas que se
   * crucen a la vez. La última se puede tomar hasta una hora antes de cerrar.
   */
  private tableSlots(
    business: Business,
    settings: BookingSettings,
    taken: Booking[],
    date: string,
    earliest: Date,
  ): Slot[] {
    const duration = settings.reservationDurationMinutes;
    return slotsFor({
      date,
      timezone: business.profile.timezone || 'UTC',
      hours: this.hoursFor(business, settings, date),
      durationMinutes: duration,
      bufferMinutes: 0,
      intervalMinutes: settings.slotIntervalMinutes,
      earliest,
      resources: [BUSINESS],
      capacity: settings.reservationsPerSlot,
      fitMinutes: Math.min(60, duration),
      busy: new Map([
        [
          BUSINESS,
          taken.map((b) => [b.startsAt.getTime(), b.blockedUntil.getTime()]),
        ],
      ]),
    });
  }

  /**
   * Cliente de la cita: con sesión, el suyo. El personal busca por
   * teléfono exacto (el más reciente) y si no hay, lo crea. Un cliente sin
   * sesión siempre es nuevo: así nadie toma la cuenta de otro con su número.
   */
  private async resolveCustomer(
    manager: EntityManager,
    businessId: string,
    dto: Pick<CreateBookingDto, 'contactName' | 'contactPhone'>,
    contact: BookingContact,
  ): Promise<string> {
    if (contact.customer) return contact.customer.id;
    if (contact.matchExisting) {
      const found = await manager.findOne(Customer, {
        where: { businessId, phone: dto.contactPhone },
        order: { createdAt: 'DESC' },
        select: { id: true },
      });
      if (found) return found.id;
    }
    const created = await manager.save(
      manager.create(Customer, {
        businessId,
        name: dto.contactName,
        phone: dto.contactPhone,
      }),
    );
    return created.id;
  }

  private async nextNumber(manager: EntityManager, businessId: string) {
    const [row] = (await manager.query(
      `SELECT COALESCE(MAX("number"), 0) + 1 AS "next" FROM "bookings" WHERE "business_id" = $1`,
      [businessId],
    )) as { next: number | string }[];
    return Number(row.next);
  }

  private async assertServices(businessId: string, ids: string[]) {
    if (!ids.length) return;
    const count = await this.items.count({
      where: { businessId, id: In(ids), kind: ItemKind.Service },
    });
    if (count !== ids.length) {
      throw new BadRequestException('Uno de los servicios no existe.');
    }
  }
}
