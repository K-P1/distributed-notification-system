import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  // Server Configuration
  get port(): number {
    return this.configService.get<number>('PORT', 3002);
  }

  get environment(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get version(): string {
    return this.configService.get<string>('VERSION', '1.0.0');
  }

  // Database Configuration
  get databaseUrl(): string {
    return this.configService.get<string>(
      'DATABASE_URL',
      'postgresql://user:password@localhost:5432/template_db',
    );
  }

  get databaseHost(): string {
    return this.configService.get<string>('DB_HOST', 'localhost');
  }

  get databasePort(): number {
    return this.configService.get<number>('DB_PORT', 5432);
  }

  get databaseUser(): string {
    return this.configService.get<string>('DB_USER', 'postgres');
  }

  get databasePassword(): string {
    return this.configService.get<string>('DB_PASSWORD', 'password');
  }

  get databaseName(): string {
    return this.configService.get<string>('DB_NAME', 'template_db');
  }

  // Redis Configuration
  get redisUrl(): string {
    return this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT', 6379);
  }

  // Cache Configuration
  get templateCacheTtl(): number {
    return this.configService.get<number>('TEMPLATE_CACHE_TTL', 3600); // 1 hour
  }

  get templateCacheMaxSize(): number {
    return this.configService.get<number>('TEMPLATE_CACHE_MAX_SIZE', 1000);
  }

  // Circuit Breaker Configuration
  get circuitBreakerThreshold(): number {
    return this.configService.get<number>('CIRCUIT_BREAKER_THRESHOLD', 5);
  }

  get circuitBreakerTimeout(): number {
    return this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT', 60000);
  }

  // Retry Configuration
  get maxRetries(): number {
    return this.configService.get<number>('MAX_RETRIES', 3);
  }

  get retryDelayMs(): number {
    return this.configService.get<number>('RETRY_DELAY_MS', 1000);
  }

  // Logging Configuration
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info');
  }

  get enableJsonLogging(): boolean {
    return this.configService.get<boolean>('ENABLE_JSON_LOGGING', true);
  }

  // Health Check Configuration
  get healthCheckInterval(): number {
    return this.configService.get<number>('HEALTH_CHECK_INTERVAL', 30000);
  }

  // Metrics Configuration
  get metricsPort(): number {
    return this.configService.get<number>('METRICS_PORT', 9091);
  }

  get enableMetrics(): boolean {
    return this.configService.get<boolean>('ENABLE_METRICS', true);
  }

  // Template Validation Configuration
  get maxTemplateSize(): number {
    return this.configService.get<number>('MAX_TEMPLATE_SIZE', 1048576); // 1MB
  }

  get allowedTemplateTypes(): string[] {
    return this.configService
      .get<string>('ALLOWED_TEMPLATE_TYPES', 'email,push')
      .split(',')
      .map((type) => type.trim());
  }

  get supportedLanguages(): string[] {
    return this.configService
      .get<string>('SUPPORTED_LANGUAGES', 'en,es,fr,de')
      .split(',')
      .map((lang) => lang.trim());
  }

  // Rate Limiting Configuration
  get rateLimitWindow(): number {
    return this.configService.get<number>('RATE_LIMIT_WINDOW', 60000); // 1 minute
  }

  get rateLimitMaxRequests(): number {
    return this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100);
  }
}
