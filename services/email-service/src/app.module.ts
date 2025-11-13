import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import { AppConfigService } from './config/config.service';

// Infrastructure
import { LoggerService } from './utils/logger.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';
import { RetryService } from './infrastructure/retry.service';
import { RabbitMQService } from './infrastructure/rabbitmq.service';

// Services
import { SMTPService } from './services/smtp.service';
import { TemplateRenderer } from './services/template-renderer.service';
import { StatusUpdateService } from './services/status-update.service';
import { EmailProcessor } from './services/email-processor.service';

// Controllers
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [AppController, HealthController, MetricsController],
  providers: [
    AppService,

    // Configuration
    AppConfigService,

    // Infrastructure
    LoggerService,
    CircuitBreakerService,
    RetryService,
    RabbitMQService,

    // Business Services
    SMTPService,
    TemplateRenderer,
    StatusUpdateService,
    EmailProcessor,
  ],
})
export class AppModule {}
