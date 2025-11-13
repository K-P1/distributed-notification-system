import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { NotificationStatus } from '../types';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { RetryService } from '../infrastructure/retry.service';
export declare class StatusUpdateService {
    private readonly config;
    private readonly logger;
    private readonly circuitBreakerService;
    private readonly retryService;
    constructor(config: AppConfigService, logger: LoggerService, circuitBreakerService: CircuitBreakerService, retryService: RetryService);
    updateNotificationStatus(notificationId: string, status: NotificationStatus, correlationId: string, error?: string, metadata?: Record<string, any>): Promise<boolean>;
    updateProcessingStatus(notificationId: string, correlationId: string): Promise<boolean>;
    updateDeliveredStatus(notificationId: string, correlationId: string, metadata?: Record<string, any>): Promise<boolean>;
    updateFailedStatus(notificationId: string, correlationId: string, error: string, metadata?: Record<string, any>): Promise<boolean>;
    checkApiGatewayHealth(): Promise<boolean>;
}
