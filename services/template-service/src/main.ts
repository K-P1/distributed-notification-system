import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { LoggerService } from './utils/logger.service';

async function bootstrap() {
  console.log('🚀 Template Service starting...');
  console.log('📊 Environment:', process.env.NODE_ENV);
  console.log('🔌 Port:', process.env.PORT);
  
  try {
    console.log('🏗️ Creating NestJS application...');
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'], // Enable console logging for debugging
    });

    console.log('⚙️ Getting configuration services...');
    const configService = app.get(AppConfigService);
    const loggerService = app.get(LoggerService);

    console.log('📝 Setting up logger...');
    app.useLogger(new Logger());

    console.log('✅ Setting up validation pipes...');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    console.log('🌐 Enabling CORS...');
    app.enableCors({
      origin: true, // In production, specify allowed origins
      credentials: true,
    });

    console.log('🛣️ Setting global prefix...');
    app.setGlobalPrefix('api/v1');

    const port = configService.port;
    console.log(`🚀 Starting server on port ${port}...`);

    await app.listen(port);
    
    console.log('✅ Template Service started successfully!');
    console.log(`🌍 Health check: http://localhost:${port}/api/v1/health`);

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
    
  } catch (error) {
    console.error('❌ Failed to start Template Service:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

bootstrap().catch(error => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});
