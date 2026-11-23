import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { BusinessAccessGuard } from '../guards/business-access.guard.js';
import { BusinessRole } from '../business-role.enum.js';
import { BUSINESS_ROLES_KEY } from './business-roles.key.js';

/**
 * Exige que el usuario sea miembro del negocio `:businessId` de la ruta.
 * Si se pasan roles, además exige uno de ellos. super_admin siempre pasa.
 */
export const BusinessAccess = (...roles: BusinessRole[]) =>
  applyDecorators(
    SetMetadata(BUSINESS_ROLES_KEY, roles),
    UseGuards(BusinessAccessGuard),
  );
