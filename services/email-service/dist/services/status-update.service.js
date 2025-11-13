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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusUpdateService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const config_service_1 = require("../config/config.service");
const logger_service_1 = require("../utils/logger.service");
const types_1 = require("../types");
const circuit_breaker_service_1 = require("../infrastructure/circuit-breaker.service");
const retry_service_1 = require("../infrastructure/retry.service");
let StatusUpdateService = class StatusUpdateService {
    config;
    logger;
    circuitBreakerService;
    retryService;
    constructor(config, logger, circuitBreakerService, retryService) {
        this.config = config;
        this.logger = logger;
        this.circuitBreakerService = circuitBreakerService;
        this.retryService = retryService;
    }
    async updateNotificationStatus(notificationId, status, correlationId, error, metadata) {
        const startTime = Date.now();
        try {
            this.logger.logWithCorrelation('info', 'status_update_start', correlationId, {
                notification_id: notificationId,
                status,
            });
            const statusUpdate = {
                notification_id: notificationId,
                status,
                timestamp: new Date().toISOString(),
                error,
                metadata,
            };
            const response = await axios_1.default.post(`${this.config.apiGatewayUrl}/api/v1/email/status/`, statusUpdate, {
                timeout: this.config.apiGatewayTimeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId,
                },
            });
            if (response.status >= 200 && response.status < 300) {
                const processingTime = Date.now() - startTime;
                this.logger.logPerformance('status_update', processingTime, true, correlationId);
                this.logger.logWithCorrelation('info', 'status_update_success', correlationId, {
                    notification_id: notificationId,
                    status,
                    processing_time_ms: processingTime,
                });
                return true;
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.logPerformance('status_update', processingTime, false, correlationId);
            this.logger.error('status_update_failed', error, {
                notification_id: notificationId,
                status,
                correlation_id: correlationId,
                processing_time_ms: processingTime,
            });
            throw error;
        }
    }
    async updateProcessingStatus(notificationId, correlationId) {
        return this.updateNotificationStatus(notificationId, types_1.NotificationStatus.PROCESSING, correlationId);
    }
    async updateDeliveredStatus(notificationId, correlationId, metadata) {
        return this.updateNotificationStatus(notificationId, types_1.NotificationStatus.DELIVERED, correlationId, undefined, metadata);
    }
    async updateFailedStatus(notificationId, correlationId, error, metadata) {
        return this.updateNotificationStatus(notificationId, types_1.NotificationStatus.FAILED, correlationId, error, metadata);
    }
    async checkApiGatewayHealth() {
        try {
            const response = await axios_1.default.get(`${this.config.apiGatewayUrl}/health`, {
                timeout: 5000,
            });
            return response.status === 200;
        }
        catch (error) {
            this.logger.error('api_gateway_health_check_failed', error);
            return false;
        }
    }
};
exports.StatusUpdateService = StatusUpdateService;
__decorate([
    (0, circuit_breaker_service_1.WithCircuitBreaker)('status_update', {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
    }),
    (0, retry_service_1.WithRetry)({
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        exponentialBackoff: true,
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], StatusUpdateService.prototype, "updateNotificationStatus", null);
exports.StatusUpdateService = StatusUpdateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        logger_service_1.LoggerService,
        circuit_breaker_service_1.CircuitBreakerService,
        retry_service_1.RetryService])
], StatusUpdateService);
//# sourceMappingURL=status-update.service.js.map