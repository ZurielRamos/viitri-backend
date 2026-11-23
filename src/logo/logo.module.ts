import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { LogoController } from './logo.controller.js';
import { LogoGeneratorService } from './logo-generator.service.js';

@Module({
  // AuthModule: límite diario de intentos (almacén con vencimiento).
  imports: [AuthModule, BusinessesModule],
  controllers: [LogoController],
  providers: [LogoGeneratorService],
})
export class LogoModule {}
