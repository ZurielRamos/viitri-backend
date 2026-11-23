import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { CurrentCustomer } from '../customers/decorators/current-customer.decorator.js';
import type { Customer } from '../customers/entities/customer.entity.js';
import { CustomerAuthGuard } from '../customers/guards/customer-auth.guard.js';
import { BookingSource } from './booking.enums.js';
import { presentBooking } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import {
  AvailabilityQueryDto,
  CreateBookingDto,
  CreateTableReservationDto,
  TableAvailabilityQueryDto,
} from './dto/booking.dto.js';
import type { Booking } from './entities/booking.entity.js';
import { effectivePlan, planIncludes } from '../businesses/plans/plans.js';

/** Sin datos internos del negocio ni del cliente. */
function toPublic(booking: Booking) {
  const {
    customerId: _customer,
    businessId: _business,
    source: _source,
    bufferMinutes: _buffer,
    ...rest
  } = presentBooking(booking);
  return rest;
}

/**
 * Citas desde la tienda: horarios libres de un servicio, agendar, seguir y
 * cancelar la cita. Como invitado o con sesión de cliente.
 */
@Public()
@Controller('public/businesses/:slug/bookings')
export class PublicBookingsController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly bookings: BookingsService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  @Get('availability/:itemId')
  async availability(
    @Param('slug') slug: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    const business = await this.findBusiness(slug, BusinessFeature.Bookings);
    return this.bookings.availability(business, itemId, query);
  }

  /** La respuesta trae `trackingToken`: lo único que permite ver la cita sin sesión. */
  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateBookingDto,
    @Req() request: Request,
  ) {
    const business = await this.findBusiness(slug, BusinessFeature.Bookings);
    const customer = await this.optionalCustomer(request, business.id);
    const { booking, trackingToken } = await this.bookings.create({
      business,
      dto,
      source: BookingSource.Customer,
      contact: { customer },
    });
    let customerToken: string | undefined;
    if (booking.customerId) {
      await this.customerAuth.rememberFromOrder(
        business.id,
        booking.customerId,
        {
          name: dto.contactName,
          phone: dto.contactPhone,
        },
      );
      // Sin sesión, se abre una en este teléfono con el cliente nuevo.
      if (!customer) {
        customerToken = await this.customerAuth.issueDeviceToken({
          id: booking.customerId,
          businessId: business.id,
        } as Customer);
      }
    }
    return { booking: toPublic(booking), trackingToken, customerToken };
  }

  @Get('tables/availability')
  async tableAvailability(
    @Param('slug') slug: string,
    @Query() query: TableAvailabilityQueryDto,
  ) {
    const business = await this.findBusiness(
      slug,
      BusinessFeature.TableReservations,
    );
    return this.bookings.tableAvailability(business, query);
  }

  /** Reserva de mesa. Como agendar: trae `trackingToken` y, sin sesión, la abre. */
  @Post('tables')
  async createTable(
    @Param('slug') slug: string,
    @Body() dto: CreateTableReservationDto,
    @Req() request: Request,
  ) {
    const business = await this.findBusiness(
      slug,
      BusinessFeature.TableReservations,
    );
    const customer = await this.optionalCustomer(request, business.id);
    const { booking, trackingToken } =
      await this.bookings.createTableReservation({
        business,
        dto,
        source: BookingSource.Customer,
        contact: { customer },
      });
    return {
      booking: toPublic(booking),
      trackingToken,
      customerToken: await this.remember(business.id, booking, dto, customer),
    };
  }

  @Get('track/:token')
  async track(@Param('slug') slug: string, @Param('token') token: string) {
    const business = await this.findBusiness(slug);
    return toPublic(
      await this.bookings.findByTrackingToken(business.id, token),
    );
  }

  @HttpCode(200)
  @Post('track/:token/cancel')
  async cancel(@Param('slug') slug: string, @Param('token') token: string) {
    const business = await this.findBusiness(slug);
    return toPublic(await this.bookings.cancelByCustomer(business.id, token));
  }

  /** Citas del cliente con sesión en este teléfono. */
  @UseGuards(CustomerAuthGuard)
  @Get('mine')
  async mine(@CurrentCustomer() customer: Customer) {
    const items = await this.bookings.listForCustomer(
      customer.businessId,
      customer.id,
    );
    return { items: items.map(toPublic) };
  }

  @UseGuards(CustomerAuthGuard)
  @HttpCode(200)
  @Post('mine/:bookingId/cancel')
  async cancelMine(
    @CurrentCustomer() customer: Customer,
    @Param('bookingId', ParseUUIDPipe) id: string,
  ) {
    return toPublic(
      await this.bookings.cancelForCustomer(
        customer.businessId,
        customer.id,
        id,
      ),
    );
  }

  /** Con `feature`, exige esa; sin ella, cualquiera de las de reservar. */
  private async findBusiness(slug: string, feature?: BusinessFeature) {
    const business = await this.businesses.findBySlugOrFail(slug);
    const needed = feature
      ? [feature]
      : [BusinessFeature.Bookings, BusinessFeature.TableReservations];
    // Las reservas están en el plan Pro.
    if (
      !needed.some((f) => business.features.includes(f)) ||
      !planIncludes(effectivePlan(business), 'pro')
    ) {
      throw new NotFoundException('Este negocio no recibe reservas.');
    }
    return business;
  }

  /** Guarda los datos del cliente; sin sesión, abre una en este teléfono. */
  private async remember(
    businessId: string,
    booking: Booking,
    dto: { contactName: string; contactPhone: string },
    customer: Customer | null,
  ): Promise<string | undefined> {
    if (!booking.customerId) return undefined;
    await this.customerAuth.rememberFromOrder(businessId, booking.customerId, {
      name: dto.contactName,
      phone: dto.contactPhone,
    });
    if (customer) return undefined;
    return this.customerAuth.issueDeviceToken({
      id: booking.customerId,
      businessId,
    } as Customer);
  }

  private async optionalCustomer(
    request: Request,
    businessId: string,
  ): Promise<Customer | null> {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    return this.customerAuth.authenticate(token, businessId);
  }
}
