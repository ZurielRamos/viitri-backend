import { ForbiddenException } from '@nestjs/common';
import type { User } from './entities/user.entity.js';

/**
 * Los perfiles del equipo (PIN) solo atienden su negocio: no crean negocios
 * ni se unen a otros. Para eso hace falta una cuenta propia.
 */
export function assertPersonalAccount(user: User): void {
  if (user.teamBusinessId) {
    throw new ForbiddenException(
      'Entraste con el PIN del equipo. Para esto necesitas tu propia cuenta.',
    );
  }
}
