import { OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { RabbitMQService } from '../infrastructure/rabbitmq.service';
import { SMTPService } from './smtp.service';
import { TemplateRenderer } from './template-renderer.service';
import { StatusUpdateService } from './status-update.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
export declare class EmailProcessor implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private readonly rabbitmqService;
    private readonly smtpService;
    private readonly templateRenderer;
    private readonly statusUpdateService;
    private readonly circuitBreakerService;
    private isProcessing;
    private processedCount;
    private failedCount;
    constructor(config: AppConfigService, logger: LoggerService, rabbitmqService: RabbitMQService, smtpService: SMTPService, templateRenderer: TemplateRenderer, statusUpdateService: StatusUpdateService, circuitBreakerService: CircuitBreakerService);
    onModuleInit(): Promise<void>;
    private startProcessing;
    private processEmailMessage;
    private validateUserPreferences;
    private isValidEmail;
    private determineFailureStage;
    getProcessingStats(): {
        is_processing: boolean;
        processed_count: number;
        failed_count: number;
        success_rate: number;
        circuit_breakers: Record<string, any>;
    };
    resetCounters(): void;
}
