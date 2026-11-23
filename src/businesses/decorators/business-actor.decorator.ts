import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.js';
import type { BusinessActor } from '../business-members.service.js';

/** Usuario actual y su membresía en el negocio. Requiere @BusinessAccess(). */
export const CurrentBusinessActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BusinessActor => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return {
      user: request.user,
      membership: request.businessMembership ?? null,
    };
  },
);
