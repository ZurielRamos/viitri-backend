import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { applyStoredSettings } from './settings/settings-bootstrap.js';

async function bootstrap() {
  // El .env primero (sin pisar las variables del sistema), luego las
  // credenciales guardadas desde el panel, que tienen prioridad. AppModule se
  // importa después: ConfigModule lee process.env al cargarse.
  try {
    process.loadEnvFile();
  } catch {
    // Sin .env: todo viene de las variables del sistema.
  }
  await applyStoredSettings();
  const { AppModule } = await import('./app.module.js');

  const app = await NestFactory.create(AppModule);

  // Se aceptan peticiones desde cualquier origen. Es seguro porque la API no
  // usa cookies: autentica con el token en el header Authorization.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta campos no declarados y rechaza la petición si llegan,
      // por ejemplo `features` al editar un negocio.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
