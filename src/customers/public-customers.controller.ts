import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CurrentCustomer } from './decorators/current-customer.decorator.js';
import {
  CustomerLoginDto,
  CustomerRegisterDto,
  UpdateMyCustomerDto,
} from './dto/customer-auth.dto.js';
import type { Customer } from './entities/customer.entity.js';
import { CustomerAuthGuard } from './guards/customer-auth.guard.js';

/**
 * Cuenta del cliente final dentro de un negocio. `@Public()` desactiva el
 * guard del personal; las rutas de sesión usan CustomerAuthGuard.
 */
@Public()
@Controller('public/businesses/:slug/customers')
export class PublicCustomersController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly auth: CustomerAuthService,
  ) {}

  @Post('register')
  async register(
    @Param('slug') slug: string,
    @Body() dto: CustomerRegisterDto,
  ) {
    const business = await this.businesses.findBySlugOrFail(slug);
    return this.auth.register(business.id, dto);
  }

  @HttpCode(200)
  @Post('login')
  async login(@Param('slug') slug: string, @Body() dto: CustomerLoginDto) {
    const business = await this.businesses.findBySlugOrFail(slug);
    return this.auth.login(business.id, dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('me')
  me(@CurrentCustomer() customer: Customer) {
    return customer;
  }

  @UseGuards(CustomerAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentCustomer() customer: Customer,
    @Body() dto: UpdateMyCustomerDto,
  ) {
    return this.auth.updateMe(customer, dto);
  }
}
