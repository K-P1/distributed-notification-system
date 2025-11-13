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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const logger_service_1 = require("../utils/logger.service");
const rabbitmq_service_1 = require("../infrastructure/rabbitmq.service");
const smtp_service_1 = require("../services/smtp.service");
const status_update_service_1 = require("../services/status-update.service");
const email_processor_service_1 = require("../services/email-processor.service");
let HealthController = class HealthController {
    config;
    logger;
    rabbitmqService;
    smtpService;
    statusUpdateService;
    emailProcessor;
    constructor(config, logger, rabbitmqService, smtpService, statusUpdateService, emailProcessor) {
        this.config = config;
        this.logger = logger;
        this.rabbitmqService = rabbitmqService;
        this.smtpService = smtpService;
        this.statusUpdateService = statusUpdateService;
        this.emailProcessor = emailProcessor;
    }
    async checkHealth() {
        const startTime = Date.now();
        try {
            const [rabbitmqHealth, smtpHealth, apiGatewayHealth] = await Promise.allSettled([
                this.rabbitmqService.checkHealth(),
                this.smtpService.checkHealth(),
                this.statusUpdateService.checkApiGatewayHealth(),
            ]);
            const dependencies = {
                rabbitmq: this.getHealthStatus(rabbitmqHealth),
                smtp: this.getHealthStatus(smtpHealth),
                redis: 'healthy',
                template_service: 'healthy',
                api_gateway: this.getHealthStatus(apiGatewayHealth),
            };
            const processingStats = this.emailProcessor.getProcessingStats();
            const queueInfo = await this.rabbitmqService.getQueueInfo(this.config.emailQueueName);
            const metrics = {
                messages_processed: processingStats.processed_count,
                messages_failed: processingStats.failed_count,
                average_processing_time: 0,
                queue_length: queueInfo?.messageCount || 0,
            };
            const overallStatus = this.determineOverallStatus(dependencies);
            const healthCheck = {
                status: overallStatus,
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                dependencies,
                metrics,
            };
            const checkTime = Date.now() - startTime;
            this.logger.logPerformance('health_check', checkTime, overallStatus === 'healthy', 'health_check');
            return healthCheck;
        }
        catch (error) {
            const checkTime = Date.now() - startTime;
            this.logger.error('health_check_failed', error);
            this.logger.logPerformance('health_check', checkTime, false, 'health_check');
            return {
                status: 'unhealthy',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                dependencies: {
                    rabbitmq: 'unhealthy',
                    smtp: 'unhealthy',
                    redis: 'unhealthy',
                    template_service: 'unhealthy',
                    api_gateway: 'unhealthy',
                },
                metrics: {
                    messages_processed: 0,
                    messages_failed: 0,
                    average_processing_time: 0,
                    queue_length: 0,
                },
            };
        }
    }
    async getDetailedHealth() {
        const healthCheck = await this.checkHealth();
        const processingStats = this.emailProcessor.getProcessingStats();
        return {
            ...healthCheck,
            service_details: {
                name: 'email-service',
                environment: this.config.environment,
                port: this.config.port,
                processing_stats: processingStats,
                smtp_config: await this.smtpService.getConnectionInfo(),
            },
        };
    }
    getHealthStatus(result) {
        if (result.status === 'fulfilled' && result.value === true) {
            return 'healthy';
        }
        return 'unhealthy';
    }
    determineOverallStatus(dependencies) {
        const criticalDependencies = ['rabbitmq', 'smtp'];
        for (const dep of criticalDependencies) {
            if (dependencies[dep] === 'unhealthy') {
                return 'unhealthy';
            }
        }
        return 'healthy';
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "checkHealth", null);
__decorate([
    (0, common_1.Get)('detailed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getDetailedHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        logger_service_1.LoggerService,
        rabbitmq_service_1.RabbitMQService,
        smtp_service_1.SMTPService,
        status_update_service_1.StatusUpdateService,
        email_processor_service_1.EmailProcessor])
], HealthController);
//# sourceMappingURL=health.controller.js.map