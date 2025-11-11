"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
let LoggerService = class LoggerService {
    logger = new common_1.Logger();
    info(message, context) {
        this.logger.log(this.formatMessage(message, context));
    }
    error(message, error, context) {
        const errorInfo = error
            ? {
                error: error.message,
                stack: error.stack,
                name: error.name,
            }
            : undefined;
        this.logger.error(this.formatMessage(message, { ...context, ...errorInfo }));
    }
    warn(message, context) {
        this.logger.warn(this.formatMessage(message, context));
    }
    debug(message, context) {
        this.logger.debug(this.formatMessage(message, context));
    }
    formatMessage(message, context) {
        if (!context)
            return message;
        const timestamp = new Date().toISOString();
        const logObject = {
            timestamp,
            message,
            service: 'email-service',
            ...context,
        };
        return JSON.stringify(logObject);
    }
    logWithCorrelation(level, message, correlationId, context) {
        const logContext = {
            correlation_id: correlationId,
            ...context,
        };
        switch (level) {
            case 'info':
                this.info(message, logContext);
                break;
            case 'error':
                this.error(message, undefined, logContext);
                break;
            case 'warn':
                this.warn(message, logContext);
                break;
            case 'debug':
                this.debug(message, logContext);
                break;
        }
    }
    logMetric(metricName, value, unit, tags) {
        this.info('metric', {
            metric_name: metricName,
            value,
            unit,
            tags,
        });
    }
    logPerformance(operation, durationMs, success, correlationId) {
        this.info('performance', {
            operation,
            duration_ms: durationMs,
            success,
            correlation_id: correlationId,
        });
    }
    logBusinessEvent(event, notificationId, correlationId, metadata) {
        this.info('business_event', {
            event,
            notification_id: notificationId,
            correlation_id: correlationId,
            ...metadata,
        });
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)()
], LoggerService);
//# sourceMappingURL=logger.service.js.map