import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '../../users/platform-role.enum.js';

export const PLATFORM_ROLES_KEY = 'platformRoles';

/** Restringe la ruta a los roles de plataforma indicados. */
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
