import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import type { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import {
  RegisterWithPhoneDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/phone-auth.dto.js';
import { OnboardingDto } from './dto/onboarding.dto.js';
import { RedeemHandoffDto } from './dto/redeem-handoff.dto.js';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password-reset.dto.js';
import { PasswordResetService } from './password-reset/password-reset.service.js';
import { SessionHandoffService } from './handoff/session-handoff.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly handoff: SessionHandoffService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /**
   * Correo y contraseña: solo para el equipo de viitri (panel de
   * administración). Los negocios entran únicamente con su WhatsApp.
   */
  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Siempre responde 200: no revela si el correo tiene cuenta. */
  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordReset.request(dto.email);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.reset(dto.token, dto.password);
    return { ok: true };
  }

  /** Siempre responde 200: no revela si el número tiene cuenta. */
  @Public()
  @HttpCode(200)
  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.auth.requestOtp(dto);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post('register-phone')
  registerWithPhone(@Body() dto: RegisterWithPhoneDto) {
    return this.auth.registerWithPhone(dto);
  }

  /** Código de un solo uso para abrir la sesión en la tienda (otro subdominio). */
  @HttpCode(200)
  @Post('handoff')
  createHandoff(@CurrentUser() user: User) {
    return this.handoff.create(user);
  }
  @Public()
  @HttpCode(200)
  @Post('handoff/redeem')
  redeemHandoff(@Body() dto: RedeemHandoffDto) {
    return this.handoff.redeem(dto.code);
  }
  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  /** Respuestas de la bienvenida. Al llamarlo, deja de mostrarse. */
  @HttpCode(200)
  @Patch('me/onboarding')
  completeOnboarding(@CurrentUser() user: User, @Body() dto: OnboardingDto) {
    return this.auth.completeOnboarding(user, dto);
  }
}
