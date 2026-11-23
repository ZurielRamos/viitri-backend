import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { RequireAnyFeature } from '../businesses/decorators/require-features.decorator.js';
import { BookingSource } from './booking.enums.js';
import { BookingsService } from './bookings.service.js';
import {
  AvailabilityQueryDto,
  CreateBookingDto,
  CreateTableReservationDto,
  ListBookingsQueryDto,
  ProfessionalInputDto,
  UpdateBookingSettingsDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto.js';
import type { Booking } from './entities/booking.entity.js';
import { RequirePlan } from '../businesses/decorators/require-plan.decorator.js';

const BusinessId = () => Param('businessId', ParseUUIDPipe);

/** Sin datos internos: el hash del enlace de seguimiento no sale de la API. */
export function presentBooking(booking: Booking) {
  const { trackingTokenHash: _hash, ...rest } = booking;
  return rest;
}

/**
 * Citas desde la tienda, para el equipo: verlas, confirmarlas, marcarlas
 * atendidas y agendar por un cliente (por ejemplo, si llamó).
 */
@RequireAnyFeature(BusinessFeature.Bookings, BusinessFeature.TableReservations)
@BusinessAccess()
@RequirePlan('pro')
@Controller('businesses/:businessId/bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get()
  async list(
    @BusinessId() businessId: string,
    @Query() query: ListBookingsQueryDto,
  ) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    return {
      items: (await this.bookings.list(business, query)).map(presentBooking),
    };
  }

  /** Horarios libres de un servicio, para agendar por un cliente. */
  @Get('availability/:itemId')
  async availability(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    return this.bookings.availability(business, itemId, query);
  }

  @Get(':bookingId')
  async findOne(
    @BusinessId() businessId: string,
    @Param('bookingId', ParseUUIDPipe) id: string,
  ) {
    return presentBooking(await this.bookings.findOneOrFail(businessId, id));
  }

  /** El personal agenda por un cliente: se busca por teléfono o se crea. Nunca abre sesión. */
  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateBookingDto,
  ) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    const { booking, trackingToken } = await this.bookings.create({
      business,
      dto,
      source: BookingSource.Staff,
      contact: { matchExisting: true },
    });
    return { booking: presentBooking(booking), trackingToken };
  }

  /** El personal reserva una mesa por un cliente (por ejemplo, si llamó). */
  @Post('tables')
  async createTable(
    @BusinessId() businessId: string,
    @Body() dto: CreateTableReservationDto,
  ) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    const { booking, trackingToken } =
      await this.bookings.createTableReservation({
        business,
        dto,
        source: BookingSource.Staff,
        contact: { matchExisting: true },
      });
    return { booking: presentBooking(booking), trackingToken };
  }

  @Patch(':bookingId/status')
  async updateStatus(
    @BusinessId() businessId: string,
    @Param('bookingId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return presentBooking(
      await this.bookings.updateStatus(businessId, id, dto.status, dto.reason),
    );
  }
}

/** Cómo recibe citas el negocio y quién las atiende. Propietario y administradores. */
@RequireAnyFeature(BusinessFeature.Bookings, BusinessFeature.TableReservations)
@RequirePlan('pro')
@Controller('businesses/:businessId')
export class BookingSettingsController {
  constructor(private readonly bookings: BookingsService) {}

  @BusinessAccess()
  @Get('booking-settings')
  getSettings(@BusinessId() businessId: string) {
    return this.bookings.getSettings(businessId);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Put('booking-settings')
  updateSettings(
    @BusinessId() businessId: string,
    @Body() dto: UpdateBookingSettingsDto,
  ) {
    return this.bookings.updateSettings(businessId, dto);
  }

  @BusinessAccess()
  @Get('booking-professionals')
  listProfessionals(@BusinessId() businessId: string) {
    return this.bookings.listProfessionals(businessId);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Post('booking-professionals')
  createProfessional(
    @BusinessId() businessId: string,
    @Body() dto: ProfessionalInputDto,
  ) {
    return this.bookings.createProfessional(businessId, dto);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Patch('booking-professionals/:professionalId')
  updateProfessional(
    @BusinessId() businessId: string,
    @Param('professionalId', ParseUUIDPipe) id: string,
    @Body() dto: ProfessionalInputDto,
  ) {
    return this.bookings.updateProfessional(businessId, id, dto);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @HttpCode(204)
  @Delete('booking-professionals/:professionalId')
  async removeProfessional(
    @BusinessId() businessId: string,
    @Param('professionalId', ParseUUIDPipe) id: string,
  ) {
    await this.bookings.removeProfessional(businessId, id);
  }
}
