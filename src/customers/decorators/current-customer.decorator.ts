import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CustomerRequest } from '../customer-jwt.js';

/** Cliente autenticado. Requiere CustomerAuthGuard. */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<CustomerRequest>().customer,
);
