import type { Request } from 'express';
import type { Business } from '../businesses/entities/business.entity.js';
import type { Customer } from './entities/customer.entity.js';

/** Token de un cliente final. Solo es válido en su negocio (`bid`). */
export interface CustomerJwtPayload {
  sub: string;
  typ: 'customer';
  bid: string;
}

export interface CustomerRequest extends Request {
  customer: Customer;
  business: Business;
}
