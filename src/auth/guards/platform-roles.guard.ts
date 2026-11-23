import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlatformRole } from '../../users/platform-role.enum.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { PLATFORM_ROLES_KEY } from '../decorators/platform-roles.decorator.js';

/** Guard global: aplica @PlatformRoles() cuando la ruta lo declara. */
@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.platformRole)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
