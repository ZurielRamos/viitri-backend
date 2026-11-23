import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service.js';
import type {
  AuthenticatedRequest,
  JwtPayload,
} from '../authenticated-request.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard global: exige un JWT válido salvo en rutas marcadas con @Public().
 * Carga el usuario en cada petición para que los cambios de rol o el
 * borrado del usuario apliquen de inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    // Los tokens de clientes finales no sirven para el panel.
    if (payload.typ !== 'user') throw new UnauthorizedException();

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    // Perfil del equipo: un PIN nuevo cierra las sesiones abiertas con el anterior.
    if (user.teamBusinessId && payload.sv !== user.sessionVersion) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
