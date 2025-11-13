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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = void 0;
const common_1 = require("@nestjs/common");
const email_processor_service_1 = require("../services/email-processor.service");
const circuit_breaker_service_1 = require("../infrastructure/circuit-breaker.service");
const logger_service_1 = require("../utils/logger.service");
let MetricsController = class MetricsController {
    emailProcessor;
    circuitBreakerService;
    logger;
    constructor(emailProcessor, circuitBreakerService, logger) {
        this.emailProcessor = emailProcessor;
        this.circuitBreakerService = circuitBreakerService;
        this.logger = logger;
    }
    getMetrics() {
        const processingStats = this.emailProcessor.getProcessingStats();
        const circuitStats = this.circuitBreakerService.getAllCircuitStats();
        return {
            service: 'email-service',
            timestamp: new Date().toISOString(),
            processing: processingStats,
            circuit_breakers: circuitStats,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
        };
    }
    getProcessingMetrics() {
        return this.emailProcessor.getProcessingStats();
    }
    getCircuitBreakerMetrics() {
        return this.circuitBreakerService.getAllCircuitStats();
    }
    resetMetrics(body) {
        const { type } = body;
        try {
            if (!type || type === 'processing') {
                this.emailProcessor.resetCounters();
                this.logger.info('processing_metrics_reset');
            }
            return {
                success: true,
                message: 'Metrics reset successfully',
                reset_types: type ? [type] : ['processing'],
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            this.logger.error('metrics_reset_failed', error);
            return {
                success: false,
                message: 'Failed to reset metrics',
                error: error.message,
            };
        }
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)('processing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "getProcessingMetrics", null);
__decorate([
    (0, common_1.Get)('circuit-breakers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "getCircuitBreakerMetrics", null);
__decorate([
    (0, common_1.Post)('reset'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "resetMetrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)('metrics'),
    __metadata("design:paramtypes", [email_processor_service_1.EmailProcessor,
        circuit_breaker_service_1.CircuitBreakerService,
        logger_service_1.LoggerService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map