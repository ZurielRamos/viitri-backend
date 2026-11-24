import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { CurrentCustomer } from '../customers/decorators/current-customer.decorator.js';
import type { Customer } from '../customers/entities/customer.entity.js';
import { CustomerAuthGuard } from '../customers/guards/customer-auth.guard.js';
import type { User } from '../users/entities/user.entity.js';
import { PushEndpointDto, PushSubscriptionDto } from './dto/push.dto.js';
import { PushService } from './push.service.js';

/** Clave pública VAPID: con `null`, la web no ofrece las notificaciones. */
@Public()
@Controller('public/push')
export class PublicPushKeyController {
  constructor(private readonly push: PushService) {}

  @Get('key')
  key() {
    return { publicKey: this.push.publicKey() };
  }
}

/** Avisos de pedidos y reservas en el celular de alguien del equipo. */
@BusinessAccess()
@Controller('businesses/:businessId/push')
export class StaffPushController {
  constructor(private readonly push: PushService) {}

  @HttpCode(200)
  @Post()
  async register(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentUser() user: User,
    @Body() dto: PushSubscriptionDto,
  ) {
    return {
      active: await this.push.register(businessId, dto, { userId: user.id }),
    };
  }

  @HttpCode(200)
  @Post('remove')
  async remove(@CurrentUser() user: User, @Body() dto: PushEndpointDto) {
    await this.push.unregister(dto.endpoint, { userId: user.id });
    return { active: false };
  }

  @HttpCode(200)
  @Post('status')
  async status(@CurrentUser() user: User, @Body() dto: PushEndpointDto) {
    return {
      active: await this.push.isRegistered(dto.endpoint, { userId: user.id }),
    };
  }
}

/** Avisos de sus pedidos y reservas en el celular de un cliente de la tienda. */
@Public()
@UseGuards(CustomerAuthGuard)
@Controller('public/businesses/:slug/push')
export class CustomerPushController {
  constructor(private readonly push: PushService) {}

  @HttpCode(200)
  @Post()
  async register(
    @CurrentCustomer() customer: Customer,
    @Body() dto: PushSubscriptionDto,
  ) {
    return {
      active: await this.push.register(customer.businessId, dto, {
        customerId: customer.id,
      }),
    };
  }

  @HttpCode(200)
  @Post('remove')
  async remove(
    @CurrentCustomer() customer: Customer,
    @Body() dto: PushEndpointDto,
  ) {
    await this.push.unregister(dto.endpoint, { customerId: customer.id });
    return { active: false };
  }

  @HttpCode(200)
  @Post('status')
  async status(
    @CurrentCustomer() customer: Customer,
    @Body() dto: PushEndpointDto,
  ) {
    return {
      active: await this.push.isRegistered(dto.endpoint, {
        customerId: customer.id,
      }),
    };
  }
}
