import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { Item } from '../catalog/entities/item.entity.js';
import { CustomersModule } from '../customers/customers.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { MenuModule } from '../menu/menu.module.js';
import { OrderItem } from './entities/order-item.entity.js';
import { OrderTab } from './entities/order-tab.entity.js';
import { Order } from './entities/order.entity.js';
import { OrderPricingService } from './order-pricing.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PublicOrdersController } from './public-orders.controller.js';
import { ReportsService } from './reports.service.js';
import {
  PublicTabsController,
  ReportsController,
  TabsController,
} from './tabs.controller.js';
import { TabsService } from './tabs.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderTab, Item]),
    BusinessesModule,
    CustomersModule,
    MenuModule,
    DeliveryModule,
    CatalogModule,
  ],
  controllers: [
    OrdersController,
    PublicOrdersController,
    TabsController,
    ReportsController,
    PublicTabsController,
  ],
  providers: [OrdersService, OrderPricingService, TabsService, ReportsService],
  exports: [OrdersService],
})
export class OrdersModule {}
