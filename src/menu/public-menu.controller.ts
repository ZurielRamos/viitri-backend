import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessFeature } from '../businesses/business-feature.enum.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { MenuSettingsService } from './menu-settings.service.js';
import { TablesService } from './tables.service.js';

@Public()
@Controller('public/businesses/:slug/menu')
export class PublicMenuController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly settings: MenuSettingsService,
    private readonly tables: TablesService,
  ) {}

  /** Qué tipos de pedido acepta el negocio y con qué condiciones. */
  @Get()
  async get(@Param('slug') slug: string) {
    const business = await this.findMenuBusiness(slug);
    const s = await this.settings.get(business.id);
    return {
      currency: business.profile.currency,
      isAcceptingOrders: s.isAcceptingOrders,
      orderTypes: {
        dineIn: s.dineInEnabled,
        pickup: s.pickupEnabled,
        delivery: s.deliveryEnabled,
      },
      pickupEstimatedMinutes: s.pickupEstimatedMinutes,
      deliveryEstimatedMinutes: s.deliveryEstimatedMinutes,
      deliveryMinOrder: s.deliveryMinOrder,
      deliveryFeeTiers: s.deliveryEnabled ? s.deliveryFeeTiers : [],
      transferInstructions: s.transferInstructions,
      deliveryFeeMode: s.deliveryFeeMode,
      deliveryFixedFee: s.deliveryFixedFee,
      deliveryZones: s.deliveryZones,
    };
  }

  /** Lo abre el QR de la mesa: confirma la mesa antes de pedir. */
  @Get('tables/:qrToken')
  async table(@Param('slug') slug: string, @Param('qrToken') qrToken: string) {
    const business = await this.findMenuBusiness(slug);
    const table = await this.tables.findActiveByQrToken(business.id, qrToken);
    return { id: table.id, name: table.name, zone: table.zone };
  }

  private async findMenuBusiness(slug: string) {
    const business = await this.businesses.findBySlugOrFail(slug);
    if (!business.features.includes(BusinessFeature.Menu)) {
      throw new NotFoundException('Este negocio no tiene menú.');
    }
    return business;
  }
}
