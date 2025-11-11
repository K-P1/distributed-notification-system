import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  // Server Configuration
  get port(): number {
    return this.configService.get<number>('PORT', 3001);
  }

  get environment(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  // RabbitMQ Configuration
  get rabbitmqUrl(): string {
    return this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@localhost:5672',
    );
  }

  get emailQueueName(): string {
    return this.configService.get<string>('EMAIL_QUEUE_NAME', 'email.queue');
  }

  get exchangeName(): string {
    return this.configService.get<string>(
      'EXCHANGE_NAME',
      'notifications.direct',
    );
  }

  get deadLetterExchange(): string {
    return this.configService.get<string>('DLX_NAME', 'notifications.dlx');
  }

  get failedQueueName(): string {
    return this.configService.get<string>('FAILED_QUEUE_NAME', 'failed.queue');
  }

  // SMTP Configuration
  get smtpHost(): string {
    return this.configService.get<string>('SMTP_HOST', 'localhost');
  }

  get smtpPort(): number {
    return this.configService.get<number>('SMTP_PORT', 587);
  }

  get smtpUser(): string {
    return this.configService.get<string>('SMTP_USER', '');
  }

  get smtpPassword(): string {
    return this.configService.get<string>('SMTP_PASSWORD', '');
  }

  get smtpSecure(): boolean {
    return this.configService.get<boolean>('SMTP_SECURE', false);
  }

  get fromEmail(): string {
    return this.configService.get<string>('FROM_EMAIL', 'noreply@example.com');
  }

  get fromName(): string {
    return this.configService.get<string>('FROM_NAME', 'Notification Service');
  }

  // Redis Configuration
  get redisUrl(): string {
    return this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
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

  get exponentialBackoff(): boolean {
    return this.configService.get<boolean>('EXPONENTIAL_BACKOFF', true);
  }

  // API Gateway Configuration
  get apiGatewayUrl(): string {
    return this.configService.get<string>(
      'API_GATEWAY_URL',
      'http://localhost:8000',
    );
  }

  get apiGatewayTimeout(): number {
    return this.configService.get<number>('API_GATEWAY_TIMEOUT', 10000);
  }

  // Logging Configuration
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info');
  }

  get enableJsonLogging(): boolean {
    return this.configService.get<boolean>('ENABLE_JSON_LOGGING', true);
  }

  // Template Service Configuration
  get templateServiceUrl(): string {
    return this.configService.get<string>(
      'TEMPLATE_SERVICE_URL',
      'http://localhost:3002',
    );
  }

  get templateServiceTimeout(): number {
    return this.configService.get<number>('TEMPLATE_SERVICE_TIMEOUT', 5000);
  }

  // Health Check Configuration
  get healthCheckInterval(): number {
    return this.configService.get<number>('HEALTH_CHECK_INTERVAL', 30000);
  }

  // Metrics Configuration
  get metricsPort(): number {
    return this.configService.get<number>('METRICS_PORT', 9090);
  }

  get enableMetrics(): boolean {
    return this.configService.get<boolean>('ENABLE_METRICS', true);
  }
}
