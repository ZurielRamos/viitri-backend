import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { BillingService } from './billing.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import type { WompiEvent } from './wompi.js';

/** El pago del plan. Solo el dueño (es quien paga). */
@BusinessAccess(BusinessRole.Owner)
@Controller('businesses/:businessId/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.billing.overview(businessId);
  }

  /** El estado de un pago (al volver del checkout, mientras llega el evento de Wompi). */
  @Get('latest')
  latest(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('ref') reference?: string,
  ) {
    return this.billing.latest(businessId, reference);
  }

  @HttpCode(200)
  @Post('checkout')
  checkout(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.billing.checkout(
      businessId,
      dto.plan,
      dto.billing,
      dto.redirectUrl,
    );
  }
}

/** URL de eventos de Wompi (se configura en su Dashboard). Pública: se valida la firma. */
@Public()
@Controller('webhooks/wompi')
export class WompiWebhookController {
  constructor(private readonly billing: BillingService) {}

  @HttpCode(200)
  @Post()
  async event(
    @Body() event: WompiEvent,
    @Headers('x-event-checksum') checksum?: string,
  ) {
    await this.billing.handleEvent(event, checksum);
    return { ok: true };
  }
}
