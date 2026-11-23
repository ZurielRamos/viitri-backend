import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { SocialIdentity } from '../social-identity.js';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const INVALID = 'No pudimos validar tu cuenta de Google. Intenta de nuevo.';

/** Verifica el token de identidad de Google contra sus claves públicas. */
@Injectable()
export class GoogleIdentityVerifier {
  /** Las claves se descargan una vez y se refrescan cuando Google las rota. */
  protected keys: JWTVerifyGetKey = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
  );

  constructor(private readonly config: ConfigService) {}

  async verify(idToken: string, nonce: string): Promise<SocialIdentity> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'El inicio de sesión con Google no está disponible.',
      );
    }

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(idToken, this.keys, {
        issuer: GOOGLE_ISSUERS,
        audience: clientId,
      }));
    } catch {
      throw new UnauthorizedException(INVALID);
    }

    // El nonce ata el token a la petición que inició la web.
    if (payload.nonce !== nonce || typeof payload.sub !== 'string') {
      throw new UnauthorizedException(INVALID);
    }
    if (payload.email_verified !== true || typeof payload.email !== 'string') {
      throw new UnauthorizedException(
        'Tu cuenta de Google no tiene un correo verificado.',
      );
    }

    const email = payload.email.toLowerCase();
    const name =
      typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : email.split('@')[0];
    return { sub: payload.sub, email, name: name.slice(0, 120) };
  }
}
