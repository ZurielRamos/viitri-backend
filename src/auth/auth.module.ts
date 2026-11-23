import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TtlEntry } from '../common/ttl-store/ttl-entry.entity.js';
import { TTL_STORE } from '../common/ttl-store/ttl-store.js';
import { TypeOrmTtlStore } from '../common/ttl-store/typeorm-ttl-store.js';
import { WhatsappAuthTemplateClient } from '../notifications/whatsapp/whatsapp-auth-template.client.js';
import { whatsappConfig } from '../notifications/whatsapp/whatsapp.config.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionHandoffService } from './handoff/session-handoff.service.js';
import { GoogleIdentityVerifier } from './google/google-identity.verifier.js';
import { OtpService, WHATSAPP_CLIENT } from './otp/otp.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PlatformRolesGuard } from './guards/platform-roles.guard.js';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    TypeOrmModule.forFeature([TtlEntry]),
    // Global: el módulo de clientes firma y verifica sus propios tokens.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Segundos. Por defecto 30 días: los dueños entran desde el celular
          // y no deben tener que iniciar sesión cada rato.
          expiresIn: Number(config.get<string>('JWT_EXPIRES_IN', '2592000')),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionHandoffService,
    OtpService,
    GoogleIdentityVerifier,
    { provide: TTL_STORE, useClass: TypeOrmTtlStore },
    {
      provide: WHATSAPP_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const settings = whatsappConfig(config);
        return settings ? new WhatsappAuthTemplateClient(settings) : null;
      },
    },
    // El orden importa: primero autenticación, luego rol de plataforma.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlatformRolesGuard },
  ],
  // El almacén con vencimiento también limita los PIN del equipo.
  exports: [AuthService, TTL_STORE],
})
export class AuthModule {}
