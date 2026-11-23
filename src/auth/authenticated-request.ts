import type { Request } from 'express';
import type { BusinessMember } from '../businesses/entities/business-member.entity.js';
import type { User } from '../users/entities/user.entity.js';

export interface AuthenticatedRequest extends Request {
  user: User;
  /**
   * Membresía del usuario en el negocio de la ruta (`:businessId`).
   * Es `null` cuando accede un super_admin que no es miembro.
   */
  businessMembership?: BusinessMember | null;
}

/** Token del personal de los negocios y de la plataforma. */
export interface JwtPayload {
  sub: string;
  typ: 'user';
  /** Perfiles del equipo: versión de la sesión (sube al cambiar el PIN). */
  sv?: number;
}
