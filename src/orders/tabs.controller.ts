import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { RequireAnyFeature } from '../businesses/decorators/require-features.decorator.js';
import { MAX_MONEY } from '../common/money.js';
import { TablesService } from '../menu/tables.service.js';
import { TabStatus } from './entities/order-tab.entity.js';
import { PaymentMethod } from './order.enums.js';
import { ReportsService } from './reports.service.js';
import { TabsService, type TabView } from './tabs.service.js';
import { RequirePlan } from '../businesses/decorators/require-plan.decorator.js';
import { canTakeOrders } from '../businesses/plans/plans.js';

export class CloseTabDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** Propina voluntaria; 0 si el cliente no quiso. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  tip: number;
}

export class DaySummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD.',
  })
  date?: string;
}

const BusinessId = () => Param('businessId', ParseUUIDPipe);

/** Cuentas de las mesas para el equipo: verlas y cobrarlas con propina. */
@RequireAnyFeature(BusinessFeature.Menu)
@BusinessAccess()
@RequirePlan('advanced')
@Controller('businesses/:businessId/tabs')
export class TabsController {
  constructor(private readonly tabs: TabsService) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @Query('status', new ParseEnumPipe(TabStatus, { optional: true }))
    status?: TabStatus,
  ) {
    return this.tabs.list(businessId, status ?? TabStatus.Open);
  }

  @Get(':tabId')
  findOne(
    @BusinessId() businessId: string,
    @Param('tabId', ParseUUIDPipe) id: string,
  ) {
    return this.tabs.findOneOrFail(businessId, id);
  }

  @HttpCode(200)
  @Post(':tabId/close')
  close(
    @BusinessId() businessId: string,
    @Param('tabId', ParseUUIDPipe) id: string,
    @Body() dto: CloseTabDto,
  ) {
    return this.tabs.close(businessId, id, dto);
  }
}

/** Ventas del día: solo propietario y administradores. */
@RequireAnyFeature(BusinessFeature.Menu)
@BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
@RequirePlan('advanced')
@Controller('businesses/:businessId/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly businesses: BusinessesService,
  ) {}

  @Get('day')
  async day(
    @BusinessId() businessId: string,
    @Query() query: DaySummaryQueryDto,
  ) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    return this.reports.day(business, query.date);
  }
}

/** Lo que ve el cliente en la mesa: lo pedido hasta ahora y "Pedir la cuenta". */
function toPublic(tab: TabView) {
  return {
    tableName: tab.tableName,
    currency: tab.currency,
    openedAt: tab.openedAt,
    billRequestedAt: tab.billRequestedAt,
    subtotal: tab.subtotal,
    orders: tab.orders.map((o) => ({
      number: o.number,
      status: o.status,
      total: o.total,
      items: o.items.map((i) => ({
        itemName: i.itemName,
        variantName: i.variantName,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
    })),
  };
}

@Public()
@Controller('public/businesses/:slug/tables/:qrToken/tab')
export class PublicTabsController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly tables: TablesService,
    private readonly tabs: TabsService,
  ) {}

  /** `null` si la mesa aún no ha pedido nada. */
  @Get()
  async get(@Param('slug') slug: string, @Param('qrToken') qrToken: string) {
    const { businessId, tableId } = await this.table(slug, qrToken);
    const tab = await this.tabs.findOpenForTable(businessId, tableId);
    return { tab: tab && toPublic(tab) };
  }

  @HttpCode(200)
  @Post('request-bill')
  async requestBill(
    @Param('slug') slug: string,
    @Param('qrToken') qrToken: string,
  ) {
    const { businessId, tableId } = await this.table(slug, qrToken);
    return { tab: toPublic(await this.tabs.requestBill(businessId, tableId)) };
  }

  private async table(slug: string, qrToken: string) {
    const business = await this.businesses.findBySlugOrFail(slug);
    if (!canTakeOrders(business)) {
      throw new NotFoundException('Este negocio no recibe pedidos en línea.');
    }
    const table = await this.tables.findActiveByQrToken(business.id, qrToken);
    return { businessId: business.id, tableId: table.id };
  }
}
