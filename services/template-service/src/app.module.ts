import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import { AppConfigService } from './config/config.service';

// Infrastructure
import { DatabaseService } from './infrastructure/database.service';
import { CacheService } from './infrastructure/cache.service';
import { CircuitBreakerService } from './infrastructure/circuit-breaker.service';

// Utils
import { LoggerService } from './utils/logger.service';

// Services
import { TemplateValidationService } from './services/validation.service';
import { TemplateService } from './services/template.service';

// Repositories
import { TemplateRepository } from './repositories/template.repository';

// Controllers
import { TemplateController } from './controllers/template.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [
    AppController,
    TemplateController,
    HealthController,
    MetricsController,
  ],
  providers: [
    AppService,
    // Configuration
    AppConfigService,

    // Infrastructure
    DatabaseService,
    CacheService,
    CircuitBreakerService,

    // Utils
    LoggerService,

    // Services
    TemplateValidationService,
    TemplateService,

    // Repositories
    TemplateRepository,
  ],
})
export class AppModule {}
