"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTPService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const config_service_1 = require("../config/config.service");
const logger_service_1 = require("../utils/logger.service");
const circuit_breaker_service_1 = require("../infrastructure/circuit-breaker.service");
const retry_service_1 = require("../infrastructure/retry.service");
let SMTPService = class SMTPService {
    config;
    logger;
    circuitBreakerService;
    retryService;
    transporter = null;
    constructor(config, logger, circuitBreakerService, retryService) {
        this.config = config;
        this.logger = logger;
        this.circuitBreakerService = circuitBreakerService;
        this.retryService = retryService;
    }
    async onModuleInit() {
        await this.initializeTransporter();
    }
    async initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.smtpHost,
                port: this.config.smtpPort,
                secure: this.config.smtpSecure,
                auth: {
                    user: this.config.smtpUser,
                    pass: this.config.smtpPassword,
                },
                pool: true,
                maxConnections: 10,
                maxMessages: 100,
            });
            if (this.transporter) {
                await this.transporter.verify();
            }
            this.logger.info('smtp_transporter_initialized');
        }
        catch (error) {
            this.logger.error('smtp_transporter_init_failed', error);
            throw error;
        }
    }
    async sendEmail(emailContent, correlationId) {
        if (!this.transporter) {
            throw new Error('SMTP transporter not initialized');
        }
        const startTime = Date.now();
        try {
            this.logger.logWithCorrelation('info', 'smtp_send_start', correlationId, {
                to: emailContent.to,
                subject: emailContent.subject,
            });
            const mailOptions = {
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                to: emailContent.to,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
                headers: {
                    'X-Correlation-ID': correlationId,
                },
            };
            const info = await this.transporter.sendMail(mailOptions);
            const processingTime = Date.now() - startTime;
            this.logger.logPerformance('smtp_send', processingTime, true, correlationId);
            this.logger.logWithCorrelation('info', 'smtp_send_success', correlationId, {
                message_id: info.messageId,
                to: emailContent.to,
                processing_time_ms: processingTime,
            });
            return true;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.logPerformance('smtp_send', processingTime, false, correlationId);
            this.logger.error('smtp_send_failed', error, {
                to: emailContent.to,
                correlation_id: correlationId,
                processing_time_ms: processingTime,
            });
            throw error;
        }
    }
    async checkHealth() {
        if (!this.transporter) {
            return false;
        }
        try {
            await this.transporter.verify();
            return true;
        }
        catch (error) {
            this.logger.error('smtp_health_check_failed', error);
            return false;
        }
    }
    async getConnectionInfo() {
        return {
            host: this.config.smtpHost,
            port: this.config.smtpPort,
            secure: this.config.smtpSecure,
            auth_configured: !!(this.config.smtpUser && this.config.smtpPassword),
        };
    }
};
exports.SMTPService = SMTPService;
__decorate([
    (0, circuit_breaker_service_1.WithCircuitBreaker)('smtp_send', {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000,
    }),
    (0, retry_service_1.WithRetry)({
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        exponentialBackoff: true,
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SMTPService.prototype, "sendEmail", null);
exports.SMTPService = SMTPService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        logger_service_1.LoggerService,
        circuit_breaker_service_1.CircuitBreakerService,
        retry_service_1.RetryService])
], SMTPService);
//# sourceMappingURL=smtp.service.js.map