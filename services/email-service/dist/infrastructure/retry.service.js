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
exports.RetryService = void 0;
exports.WithRetry = WithRetry;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../utils/logger.service");
let RetryService = class RetryService {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async executeWithRetry(operation, config, operationName, correlationId) {
        let lastError;
        let attempt = 0;
        while (attempt <= config.maxRetries) {
            try {
                if (attempt > 0) {
                    this.logger.logWithCorrelation('info', 'retry_attempt', correlationId, {
                        operation: operationName,
                        attempt,
                        max_retries: config.maxRetries,
                    });
                }
                const result = await operation();
                if (attempt > 0) {
                    this.logger.logWithCorrelation('info', 'retry_success', correlationId, {
                        operation: operationName,
                        attempt,
                        max_retries: config.maxRetries,
                    });
                }
                return result;
            }
            catch (error) {
                lastError = error;
                attempt++;
                if (!this.isRetryableError(lastError, config)) {
                    this.logger.logWithCorrelation('error', 'non_retryable_error', correlationId, {
                        operation: operationName,
                        attempt,
                        error: lastError.message,
                    });
                    throw lastError;
                }
                if (attempt > config.maxRetries) {
                    this.logger.logWithCorrelation('error', 'retry_exhausted', correlationId, {
                        operation: operationName,
                        attempts: attempt,
                        max_retries: config.maxRetries,
                        error: lastError.message,
                    });
                    throw lastError;
                }
                const delayMs = this.calculateDelay(attempt - 1, config);
                this.logger.logWithCorrelation('warn', 'retry_failure', correlationId, {
                    operation: operationName,
                    attempt,
                    max_retries: config.maxRetries,
                    delay_ms: delayMs,
                    error: lastError.message,
                });
                await this.delay(delayMs);
            }
        }
        throw lastError;
    }
    isRetryableError(error, config) {
        if (!config.retryableErrors || config.retryableErrors.length === 0) {
            return true;
        }
        return config.retryableErrors.some((RetryableError) => error instanceof RetryableError);
    }
    calculateDelay(attemptNumber, config) {
        if (!config.exponentialBackoff) {
            return config.initialDelayMs;
        }
        const exponentialDelay = config.initialDelayMs * Math.pow(2, attemptNumber);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        const totalDelay = exponentialDelay + jitter;
        return Math.min(totalDelay, config.maxDelayMs);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.RetryService = RetryService;
exports.RetryService = RetryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], RetryService);
function WithRetry(config = {}) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const operationName = `${target.constructor.name}.${propertyName}`;
        descriptor.value = async function (...args) {
            const retryService = this.retryService;
            if (!retryService) {
                throw new Error('RetryService not injected');
            }
            const retryConfig = {
                maxRetries: 3,
                initialDelayMs: 1000,
                maxDelayMs: 30000,
                exponentialBackoff: true,
                ...config,
            };
            const correlationId = args.find((arg) => arg?.correlationId)?.correlationId;
            return retryService.executeWithRetry(() => method.apply(this, args), retryConfig, operationName, correlationId);
        };
    };
}
//# sourceMappingURL=retry.service.js.map