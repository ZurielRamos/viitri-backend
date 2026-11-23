import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { CustomersService } from './customers.service.js';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/manage-customer.dto.js';
import { RequirePlan } from '../businesses/decorators/require-plan.decorator.js';

/** Clientes del negocio, gestionados por cualquier miembro del personal. */
@BusinessAccess()
@RequirePlan('advanced')
@Controller('businesses/:businessId/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListCustomersQueryDto,
  ) {
    return this.customers.list(businessId, query);
  }

  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(businessId, dto);
  }

  @Get(':customerId')
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.customers.findOneOrFail(businessId, customerId);
  }

  @Patch(':customerId')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(businessId, customerId, dto);
  }
}
