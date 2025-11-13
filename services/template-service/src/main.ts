import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { LoggerService } from './utils/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // We'll use our custom logger
  });

  // Get config service
  const configService = app.get(AppConfigService);
  const loggerService = app.get(LoggerService);

  // Set up custom logger
  app.useLogger(new Logger());

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for cross-service communication
  app.enableCors({
    origin: true, // In production, specify allowed origins
    credentials: true,
  });

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.port;

  await app.listen(port);

  loggerService.info('template_service_started', {
    port,
    environment: configService.environment,
    version: configService.version,
    pid: process.pid,
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    loggerService.info('template_service_shutdown_sigint');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    loggerService.info('template_service_shutdown_sigterm');
    await app.close();
    process.exit(0);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    loggerService.error(
      'unhandled_promise_rejection',
      new Error(String(reason)),
      {
        promise: String(promise),
      },
    );
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    loggerService.error('uncaught_exception', error);
    process.exit(1);
  });
}

bootstrap();
