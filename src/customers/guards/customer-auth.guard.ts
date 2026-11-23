import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { BusinessesService } from '../../businesses/businesses.service.js';
import { CustomerAuthService } from '../customer-auth.service.js';
import type { CustomerRequest } from '../customer-jwt.js';

/**
 * Para rutas públicas `/public/businesses/:slug/...` que requieren un cliente
 * con sesión. Resuelve el negocio por slug y exige que el token sea de un
 * cliente de ese mismo negocio.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly auth: CustomerAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    const business = await this.businesses.findBySlugOrFail(
      String(request.params.slug),
    );
    request.business = business;
    request.customer = await this.auth.authenticate(token, business.id);
    return true;
  }
}
