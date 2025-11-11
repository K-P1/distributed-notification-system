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
exports.EmailProcessor = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const logger_service_1 = require("../utils/logger.service");
const rabbitmq_service_1 = require("../infrastructure/rabbitmq.service");
const smtp_service_1 = require("./smtp.service");
const template_renderer_service_1 = require("./template-renderer.service");
const status_update_service_1 = require("./status-update.service");
const circuit_breaker_service_1 = require("../infrastructure/circuit-breaker.service");
let EmailProcessor = class EmailProcessor {
    config;
    logger;
    rabbitmqService;
    smtpService;
    templateRenderer;
    statusUpdateService;
    circuitBreakerService;
    isProcessing = false;
    processedCount = 0;
    failedCount = 0;
    constructor(config, logger, rabbitmqService, smtpService, templateRenderer, statusUpdateService, circuitBreakerService) {
        this.config = config;
        this.logger = logger;
        this.rabbitmqService = rabbitmqService;
        this.smtpService = smtpService;
        this.templateRenderer = templateRenderer;
        this.statusUpdateService = statusUpdateService;
        this.circuitBreakerService = circuitBreakerService;
    }
    async onModuleInit() {
        this.startProcessing();
    }
    async startProcessing() {
        try {
            this.logger.info('email_processor_starting');
            this.isProcessing = true;
            await this.rabbitmqService.consume(this.config.emailQueueName, this.processEmailMessage.bind(this));
            this.logger.info('email_processor_started', {
                queue: this.config.emailQueueName,
            });
        }
        catch (error) {
            this.logger.error('email_processor_start_failed', error);
            this.isProcessing = false;
            throw error;
        }
    }
    async processEmailMessage(message, correlationId) {
        const startTime = Date.now();
        const notificationId = message.notification_id;
        try {
            this.logger.logBusinessEvent('email_processing_start', notificationId, correlationId, {
                user_id: message.user_id,
                template_code: message.template_code,
                priority: message.priority,
            });
            await this.statusUpdateService.updateProcessingStatus(notificationId, correlationId);
            if (!this.validateUserPreferences(message)) {
                throw new Error('User has disabled email notifications');
            }
            if (!this.templateRenderer.validateTemplate(message.template_data)) {
                throw new Error('Invalid template data');
            }
            const emailContent = await this.templateRenderer.renderEmailTemplate(message, correlationId);
            const success = await this.smtpService.sendEmail(emailContent, correlationId);
            if (success) {
                await this.statusUpdateService.updateDeliveredStatus(notificationId, correlationId, {
                    delivery_method: 'smtp',
                    recipient: emailContent.to,
                    subject: emailContent.subject,
                });
                this.processedCount++;
                const processingTime = Date.now() - startTime;
                this.logger.logBusinessEvent('email_processing_success', notificationId, correlationId, {
                    user_id: message.user_id,
                    template_code: message.template_code,
                    recipient: emailContent.to,
                    processing_time_ms: processingTime,
                });
                this.logger.logMetric('email_processed', 1, 'count', {
                    status: 'success',
                    template_code: message.template_code,
                });
            }
            else {
                throw new Error('SMTP send returned false');
            }
        }
        catch (error) {
            this.failedCount++;
            const processingTime = Date.now() - startTime;
            this.logger.logBusinessEvent('email_processing_failed', notificationId, correlationId, {
                user_id: message.user_id,
                template_code: message.template_code,
                error: error.message,
                processing_time_ms: processingTime,
            });
            try {
                await this.statusUpdateService.updateFailedStatus(notificationId, correlationId, error.message, {
                    failure_stage: this.determineFailureStage(error),
                    template_code: message.template_code,
                });
            }
            catch (statusError) {
                this.logger.error('status_update_after_failure_failed', statusError, {
                    notification_id: notificationId,
                    correlation_id: correlationId,
                });
            }
            this.logger.logMetric('email_processed', 1, 'count', {
                status: 'failed',
                template_code: message.template_code,
            });
            throw error;
        }
    }
    validateUserPreferences(message) {
        try {
            const { user_data } = message;
            if (!user_data.preferences.email) {
                this.logger.logWithCorrelation('warn', 'email_disabled_by_user', '', {
                    user_id: user_data.id,
                    notification_id: message.notification_id,
                });
                return false;
            }
            if (!user_data.email || !this.isValidEmail(user_data.email)) {
                this.logger.logWithCorrelation('warn', 'invalid_user_email', '', {
                    user_id: user_data.id,
                    notification_id: message.notification_id,
                    email: user_data.email,
                });
                return false;
            }
            return true;
        }
        catch (error) {
            this.logger.error('user_preference_validation_failed', error, {
                notification_id: message.notification_id,
                user_id: message.user_id,
            });
            return false;
        }
    }
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    determineFailureStage(error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('template') || errorMessage.includes('render')) {
            return 'template_rendering';
        }
        else if (errorMessage.includes('smtp') || errorMessage.includes('mail')) {
            return 'smtp_delivery';
        }
        else if (errorMessage.includes('user') ||
            errorMessage.includes('preference')) {
            return 'user_validation';
        }
        else if (errorMessage.includes('status') ||
            errorMessage.includes('update')) {
            return 'status_update';
        }
        else {
            return 'unknown';
        }
    }
    getProcessingStats() {
        return {
            is_processing: this.isProcessing,
            processed_count: this.processedCount,
            failed_count: this.failedCount,
            success_rate: this.processedCount + this.failedCount > 0
                ? this.processedCount / (this.processedCount + this.failedCount)
                : 0,
            circuit_breakers: this.circuitBreakerService.getAllCircuitStats(),
        };
    }
    resetCounters() {
        this.processedCount = 0;
        this.failedCount = 0;
    }
};
exports.EmailProcessor = EmailProcessor;
exports.EmailProcessor = EmailProcessor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        logger_service_1.LoggerService,
        rabbitmq_service_1.RabbitMQService,
        smtp_service_1.SMTPService,
        template_renderer_service_1.TemplateRenderer,
        status_update_service_1.StatusUpdateService,
        circuit_breaker_service_1.CircuitBreakerService])
], EmailProcessor);
//# sourceMappingURL=email-processor.service.js.map