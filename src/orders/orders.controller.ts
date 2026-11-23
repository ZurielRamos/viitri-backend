import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import type { User } from '../users/entities/user.entity.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { RequireAnyFeature } from '../businesses/decorators/require-features.decorator.js';
import { CustomersService } from '../customers/customers.service.js';
import { MenuSettingsService } from '../menu/menu-settings.service.js';
import { TablesService } from '../menu/tables.service.js';
import {
  ListOrdersQueryDto,
  MarkOrderPaidDto,
  StaffCreateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto.js';
import { OrderSource } from './order.enums.js';
import { OrdersService, type OrderDraft } from './orders.service.js';
import { RequirePlan } from '../businesses/decorators/require-plan.decorator.js';

const BusinessId = () => Param('businessId', ParseUUIDPipe);
const OrderId = () => Param('orderId', ParseUUIDPipe);

/**
 * Pedidos desde el panel. Cualquier miembro del personal puede verlos,
 * tomarlos, cambiarles el estado y cobrarlos.
 */
@RequireAnyFeature(BusinessFeature.Menu)
@BusinessAccess()
@RequirePlan('advanced')
@Controller('businesses/:businessId/orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly businesses: BusinessesService,
    private readonly settings: MenuSettingsService,
    private readonly tables: TablesService,
    private readonly customers: CustomersService,
  ) {}

  @Get()
  list(@BusinessId() businessId: string, @Query() query: ListOrdersQueryDto) {
    return this.orders.list(businessId, query);
  }

  @Get(':orderId')
  findOne(@BusinessId() businessId: string, @OrderId() id: string) {
    return this.orders.findOneOrFail(businessId, id);
  }

  @HttpCode(200)
  @Post('quote')
  async quote(
    @BusinessId() businessId: string,
    @Body() dto: StaffCreateOrderDto,
  ) {
    const { business, settings, draft } = await this.prepare(businessId, dto);
    return this.orders.presentQuote(
      await this.orders.quote(business, settings, draft),
    );
  }

  /** Lo toma el personal: entra aceptado, sin pasar por `pending`. */
  @Post()
  async create(
    @CurrentUser() user: User,
    @BusinessId() businessId: string,
    @Body() dto: StaffCreateOrderDto,
  ) {
    const { business, settings, draft } = await this.prepare(businessId, dto);
    const customer = dto.customerId
      ? await this.customers.findOneOrFail(businessId, dto.customerId)
      : null;
    const { order, trackingToken } = await this.orders.create({
      business,
      settings,
      draft,
      source: OrderSource.Staff,
      contact: {
        customer,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        // Sin cliente elegido: uno existente que coincida o uno nuevo; nunca abre sesión.
        matchExisting: !customer,
      },
      notes: dto.notes,
      takenBy: user.name,
    });
    return { order, trackingToken };
  }

  @Patch(':orderId/status')
  updateStatus(
    @CurrentUser() user: User,
    @BusinessId() businessId: string,
    @OrderId() id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(businessId, id, dto, user.name);
  }

  @Patch(':orderId/payment')
  markPaid(
    @CurrentUser() user: User,
    @BusinessId() businessId: string,
    @OrderId() id: string,
    @Body() dto: MarkOrderPaidDto,
  ) {
    return this.orders.markPaid(businessId, id, dto.paymentMethod, user.name);
  }

  private async prepare(businessId: string, dto: StaffCreateOrderDto) {
    const business =
      await this.businesses.findByIdWithProfileOrFail(businessId);
    const settings = await this.settings.get(businessId);
    const table = dto.tableId
      ? await this.tables.findOneOrFail(businessId, dto.tableId)
      : null;
    const draft: OrderDraft = {
      type: dto.type,
      items: dto.items,
      table,
      tableLabel: table ? undefined : dto.tableLabel,
      delivery: dto.delivery,
      paymentMethod: dto.paymentMethod,
      cashChangeFor: dto.cashChangeFor,
    };
    return { business, settings, draft };
  }
}
