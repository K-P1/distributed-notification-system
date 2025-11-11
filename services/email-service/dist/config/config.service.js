"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AppConfigService = class AppConfigService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    get port() {
        return this.configService.get('PORT', 3001);
    }
    get environment() {
        return this.configService.get('NODE_ENV', 'development');
    }
    get rabbitmqUrl() {
        return this.configService.get('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
    }
    get emailQueueName() {
        return this.configService.get('EMAIL_QUEUE_NAME', 'email.queue');
    }
    get exchangeName() {
        return this.configService.get('EXCHANGE_NAME', 'notifications.direct');
    }
    get deadLetterExchange() {
        return this.configService.get('DLX_NAME', 'notifications.dlx');
    }
    get failedQueueName() {
        return this.configService.get('FAILED_QUEUE_NAME', 'failed.queue');
    }
    get smtpHost() {
        return this.configService.get('SMTP_HOST', 'localhost');
    }
    get smtpPort() {
        return this.configService.get('SMTP_PORT', 587);
    }
    get smtpUser() {
        return this.configService.get('SMTP_USER', '');
    }
    get smtpPassword() {
        return this.configService.get('SMTP_PASSWORD', '');
    }
    get smtpSecure() {
        return this.configService.get('SMTP_SECURE', false);
    }
    get fromEmail() {
        return this.configService.get('FROM_EMAIL', 'noreply@example.com');
    }
    get fromName() {
        return this.configService.get('FROM_NAME', 'Notification Service');
    }
    get redisUrl() {
        return this.configService.get('REDIS_URL', 'redis://localhost:6379');
    }
    get circuitBreakerThreshold() {
        return this.configService.get('CIRCUIT_BREAKER_THRESHOLD', 5);
    }
    get circuitBreakerTimeout() {
        return this.configService.get('CIRCUIT_BREAKER_TIMEOUT', 60000);
    }
    get maxRetries() {
        return this.configService.get('MAX_RETRIES', 3);
    }
    get retryDelayMs() {
        return this.configService.get('RETRY_DELAY_MS', 1000);
    }
    get exponentialBackoff() {
        return this.configService.get('EXPONENTIAL_BACKOFF', true);
    }
    get apiGatewayUrl() {
        return this.configService.get('API_GATEWAY_URL', 'http://localhost:8000');
    }
    get apiGatewayTimeout() {
        return this.configService.get('API_GATEWAY_TIMEOUT', 10000);
    }
    get logLevel() {
        return this.configService.get('LOG_LEVEL', 'info');
    }
    get enableJsonLogging() {
        return this.configService.get('ENABLE_JSON_LOGGING', true);
    }
    get templateServiceUrl() {
        return this.configService.get('TEMPLATE_SERVICE_URL', 'http://localhost:3002');
    }
    get templateServiceTimeout() {
        return this.configService.get('TEMPLATE_SERVICE_TIMEOUT', 5000);
    }
    get healthCheckInterval() {
        return this.configService.get('HEALTH_CHECK_INTERVAL', 30000);
    }
    get metricsPort() {
        return this.configService.get('METRICS_PORT', 9090);
    }
    get enableMetrics() {
        return this.configService.get('ENABLE_METRICS', true);
    }
};
exports.AppConfigService = AppConfigService;
exports.AppConfigService = AppConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AppConfigService);
//# sourceMappingURL=config.service.js.map