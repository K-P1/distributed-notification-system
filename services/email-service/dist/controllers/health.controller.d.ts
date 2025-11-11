import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { RabbitMQService } from '../infrastructure/rabbitmq.service';
import { SMTPService } from '../services/smtp.service';
import { StatusUpdateService } from '../services/status-update.service';
import { EmailProcessor } from '../services/email-processor.service';
import type { HealthCheck } from '../types';
export declare class HealthController {
    private readonly config;
    private readonly logger;
    private readonly rabbitmqService;
    private readonly smtpService;
    private readonly statusUpdateService;
    private readonly emailProcessor;
    constructor(config: AppConfigService, logger: LoggerService, rabbitmqService: RabbitMQService, smtpService: SMTPService, statusUpdateService: StatusUpdateService, emailProcessor: EmailProcessor);
    checkHealth(): Promise<HealthCheck>;
    getDetailedHealth(): Promise<{
        service_details: {
            name: string;
            environment: string;
            port: number;
            processing_stats: {
                is_processing: boolean;
                processed_count: number;
                failed_count: number;
                success_rate: number;
                circuit_breakers: Record<string, any>;
            };
            smtp_config: any;
        };
        status: "healthy" | "unhealthy";
        version: string;
        timestamp: string;
        dependencies: {
            rabbitmq: "healthy" | "unhealthy";
            smtp: "healthy" | "unhealthy";
            redis: "healthy" | "unhealthy";
            template_service: "healthy" | "unhealthy";
            api_gateway: "healthy" | "unhealthy";
        };
        metrics: {
            messages_processed: number;
            messages_failed: number;
            average_processing_time: number;
            queue_length: number;
        };
    }>;
    private getHealthStatus;
    private determineOverallStatus;
}
