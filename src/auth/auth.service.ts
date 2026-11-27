import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../users/entities/user.entity.js';
import { AccountMailService } from '../notifications/mail/account-mail.service.js';
import { normalizeWhatsappNumber } from '../notifications/whatsapp/whatsapp-phone.js';
import { PlatformRole } from '../users/platform-role.enum.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './authenticated-request.js';
import type { LoginDto } from './dto/login.dto.js';
import type {
  GoogleLoginDto,
  SocialVerifyPhoneDto,
  RegisterWithPhoneDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/phone-auth.dto.js';
import type { OnboardingDto } from './dto/onboarding.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { SignupExtrasDto } from './dto/signup-extras.dto.js';
import { GoogleIdentityVerifier } from './google/google-identity.verifier.js';
import { OtpService } from './otp/otp.service.js';
import {
  PROVIDER_LABEL,
  type SocialIdentity,
  type SocialProvider,
} from './social-identity.js';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Resultado de verificar el código: sesión iniciada o registro pendiente. */
export type VerifyOtpResponse =
  | ({ status: 'authenticated' } & AuthResponse)
  | { status: 'registration_required'; registrationToken: string };

/** 180 días: la tablet de la cocina no debe pedir el PIN cada mes. */
const TEAM_SESSION_SECONDS = 180 * 24 * 60 * 60;

/** Sesión sin "recordarme": un día. */
const SHORT_SESSION_SECONDS = 24 * 60 * 60;

const OTP_TARGET = { purpose: 'auth', scope: 'platform' } as const;
const REGISTRATION_TOKEN_TYP = 'phone-registration';
const REGISTRATION_TOKEN_TTL_SECONDS = 15 * 60;

interface RegistrationTokenPayload {
  typ: typeof REGISTRATION_TOKEN_TYP;
  phone: string;
}

/** Resultado de entrar con Google: sesión o falta verificar WhatsApp. */
export type SocialLoginResponse =
  | ({ status: 'authenticated' } & AuthResponse)
  | {
      status: 'phone_required';
      pendingToken: string;
      email: string;
      /** Sin cuenta previa: la web debe pedir la aceptación de términos. */
      newAccount: boolean;
    };

const SOCIAL_PENDING_TYP = 'social-pending';
const SOCIAL_PENDING_TTL_SECONDS = 15 * 60;

interface SocialPendingPayload {
  typ: typeof SOCIAL_PENDING_TYP;
  provider: SocialProvider;
  providerSub: string;
  email: string;
  name: string;
  /** Usuario existente que coincidió por correo o por la cuenta del proveedor. */
  userId?: string;
}

/** Campo del usuario donde se guarda el `sub` de cada proveedor. */
const SUB_FIELD = { google: 'googleSub' } as const;

const TERMS_REQUIRED =
  'Debes aceptar los términos y la política de datos para crear tu cuenta.';

/**
 * Consentimientos y origen de una cuenta nueva. Sin aceptación de términos
 * no se crea la cuenta: la fecha queda como constancia (Ley 1581).
 */
function signupData(extras: SignupExtrasDto) {
  if (extras.acceptedTerms !== true) {
    throw new BadRequestException(TERMS_REQUIRED);
  }
  const now = new Date();
  return {
    termsAcceptedAt: now,
    marketingOptInAt: extras.marketingOptIn === true ? now : null,
    acquisition: extras.acquisition ?? null,
  };
}

@Injectable()
export class AuthService {
  /** Hash fijo para igualar tiempos cuando el email no existe. */
  private readonly dummyHash = argon2.hash('timing-equalizer');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly accountMail: AccountMailService,
    private readonly otp: OtpService,
    private readonly google: GoogleIdentityVerifier,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      ...signupData(dto),
    });
    // Sin await: la respuesta no espera al servidor SMTP y sendWelcome no lanza.
    void this.accountMail.sendWelcome(user);
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(hash, dto.password);
    // Las cuentas creadas con WhatsApp no tienen contraseña: nunca entran por
    // aquí. Y con contraseña solo entra el equipo de viitri (super admin).
    if (
      !user?.passwordHash ||
      !valid ||
      user.platformRole !== PlatformRole.SuperAdmin
    ) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    return this.issueToken(
      await this.users.findByIdOrFail(user.id),
      dto.remember === false ? SHORT_SESSION_SECONDS : undefined,
    );
  }

  /** Envía el código por WhatsApp. No revela si el número ya tiene cuenta. */
  async requestOtp(dto: RequestOtpDto): Promise<void> {
    await this.otp.send({ ...OTP_TARGET, phone: dto.phone });
  }

  /**
   * Con el código correcto, el número queda verificado: si ya tiene cuenta
   * inicia sesión; si no, devuelve un token corto para completar el registro.
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    await this.assertOtp(dto);

    // En la base el teléfono va solo con dígitos.
    const phone = normalizeWhatsappNumber(dto.phone);
    const user = await this.users.findByPhone(phone);
    if (user)
      return { status: 'authenticated', ...(await this.issueToken(user)) };

    const payload: RegistrationTokenPayload = {
      typ: REGISTRATION_TOKEN_TYP,
      phone,
    };
    return {
      status: 'registration_required',
      registrationToken: await this.jwt.signAsync(payload, {
        expiresIn: REGISTRATION_TOKEN_TTL_SECONDS,
      }),
    };
  }

  /** Crea la cuenta de un número ya verificado. No lleva contraseña. */
  async registerWithPhone(dto: RegisterWithPhoneDto): Promise<AuthResponse> {
    let payload: RegistrationTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RegistrationTokenPayload>(
        dto.registrationToken,
      );
    } catch {
      throw new UnauthorizedException(
        'La verificación expiró. Vuelve a verificar tu número.',
      );
    }
    if (payload.typ !== REGISTRATION_TOKEN_TYP || !payload.phone) {
      throw new UnauthorizedException(
        'La verificación expiró. Vuelve a verificar tu número.',
      );
    }

    const user = await this.users.create({
      email: dto.email ?? null,
      name: dto.name,
      passwordHash: null,
      phone: payload.phone,
      ...signupData(dto),
    });
    void this.accountMail.sendWelcome(user);
    return this.issueToken(user);
  }

  async loginWithGoogle(dto: GoogleLoginDto): Promise<SocialLoginResponse> {
    const identity = await this.google.verify(dto.idToken, dto.nonce);
    return this.loginWithIdentity('google', identity);
  }

  /**
   * Si la cuenta ya tiene WhatsApp verificado inicia sesión; si no, devuelve
   * un token corto para verificarlo antes de entrar.
   */
  private async loginWithIdentity(
    provider: SocialProvider,
    identity: SocialIdentity,
  ): Promise<SocialLoginResponse> {
    const field = SUB_FIELD[provider];
    let user = await this.users.findByProviderSub(provider, identity.sub);
    if (!user) {
      const byEmail = await this.users.findByEmail(identity.email);
      if (byEmail?.[field]) {
        throw new ConflictException(
          `Este correo ya está vinculado a otra cuenta de ${PROVIDER_LABEL[provider]}.`,
        );
      }
      // El proveedor verificó el correo: se vincula a la cuenta que ya lo usa.
      if (byEmail) {
        user = await this.users.linkIdentity(byEmail.id, {
          [field]: identity.sub,
        });
      }
    }

    if (user?.phone) {
      return { status: 'authenticated', ...(await this.issueToken(user)) };
    }

    const payload: SocialPendingPayload = {
      typ: SOCIAL_PENDING_TYP,
      provider,
      providerSub: identity.sub,
      email: identity.email,
      name: identity.name,
      ...(user && { userId: user.id }),
    };
    return {
      status: 'phone_required',
      email: identity.email,
      newAccount: !user,
      pendingToken: await this.jwt.signAsync(payload, {
        expiresIn: SOCIAL_PENDING_TTL_SECONDS,
      }),
    };
  }

  /** Verifica el WhatsApp de quien entró con Google y abre la sesión. */
  async verifySocialPhone(dto: SocialVerifyPhoneDto): Promise<AuthResponse> {
    // Primero el token: uno inválido no debe consumir el código.
    const pending = await this.readSocialPending(dto.pendingToken);
    await this.assertOtp(dto);

    const field = SUB_FIELD[pending.provider];
    const phone = normalizeWhatsappNumber(dto.phone);
    const phoneOwner = await this.users.findByPhone(phone);

    if (pending.userId) {
      if (phoneOwner && phoneOwner.id !== pending.userId) {
        throw new ConflictException(
          'Este número ya está asociado a otra cuenta.',
        );
      }
      return this.issueToken(
        await this.users.linkIdentity(pending.userId, {
          phone,
          [field]: pending.providerSub,
        }),
      );
    }

    if (phoneOwner) {
      const linked = phoneOwner[field];
      if (linked && linked !== pending.providerSub) {
        throw new ConflictException(
          `Este número ya está vinculado a otra cuenta de ${PROVIDER_LABEL[pending.provider]}.`,
        );
      }
      // Demostró ser dueño del número y del correo: se unen en esa cuenta.
      return this.issueToken(
        await this.users.linkIdentity(phoneOwner.id, {
          [field]: pending.providerSub,
        }),
      );
    }

    const user = await this.users.create({
      email: pending.email,
      name: pending.name,
      passwordHash: null,
      phone,
      [field]: pending.providerSub,
      ...signupData(dto.signup ?? {}),
    });
    void this.accountMail.sendWelcome(user);
    return this.issueToken(user);
  }

  private async readSocialPending(
    token: string,
  ): Promise<SocialPendingPayload> {
    const expired = new UnauthorizedException(
      'La sesión expiró. Vuelve a intentarlo.',
    );
    let payload: SocialPendingPayload;
    try {
      payload = await this.jwt.verifyAsync<SocialPendingPayload>(token);
    } catch {
      throw expired;
    }
    if (
      payload.typ !== SOCIAL_PENDING_TYP ||
      !payload.providerSub ||
      !(payload.provider in SUB_FIELD)
    ) {
      throw expired;
    }
    return payload;
  }

  /** Termina la bienvenida. Se puede llamar una sola vez con efecto. */
  async completeOnboarding(user: User, dto: OnboardingDto): Promise<User> {
    if (user.onboardedAt) return user;
    return this.users.completeOnboarding(user.id, dto.referralSource ?? null);
  }

  /** Comprueba el código y traduce cada fallo a un error HTTP. */
  private async assertOtp(dto: VerifyOtpDto): Promise<void> {
    const result = await this.otp.verify(
      { ...OTP_TARGET, phone: dto.phone },
      dto.code,
    );
    switch (result.status) {
      case 'not_found':
        throw new BadRequestException(
          'El código expiró o no existe. Solicita uno nuevo.',
        );
      case 'mismatch':
        throw new BadRequestException('El código es incorrecto.');
      case 'too_many_attempts':
        throw new HttpException(
          'Demasiados intentos. Solicita un código nuevo.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'ok':
        return;
    }
  }

  /** Sesión de un perfil del equipo (PIN). Dura más: suele ser la tablet del local. */
  async issueTeamToken(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      typ: 'user',
      sv: user.sessionVersion,
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: TEAM_SESSION_SECONDS,
      }),
      user,
    };
  }

  private async issueToken(
    user: User,
    expiresIn?: number,
  ): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, typ: 'user' };
    return {
      accessToken: await this.jwt.signAsync(
        payload,
        expiresIn ? { expiresIn } : undefined,
      ),
      user,
    };
  }
}
