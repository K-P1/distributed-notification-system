import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { LoggerService } from './utils/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Use our custom logger
  });

  // Get configuration service
  const configService = app.get(AppConfigService);
  const logger = app.get(LoggerService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS if needed
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  const port = configService.port;
  await app.listen(port);

  logger.info('email_service_started', {
    port,
    environment: configService.environment,
    version: '1.0.0',
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start email service:', error);
  process.exit(1);
});
