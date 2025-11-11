import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import type { EmailContent } from '../types';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { RetryService } from '../infrastructure/retry.service';
export declare class SMTPService {
    private readonly config;
    private readonly logger;
    private readonly circuitBreakerService;
    private readonly retryService;
    private transporter;
    constructor(config: AppConfigService, logger: LoggerService, circuitBreakerService: CircuitBreakerService, retryService: RetryService);
    onModuleInit(): Promise<void>;
    private initializeTransporter;
    sendEmail(emailContent: EmailContent, correlationId: string): Promise<boolean>;
    checkHealth(): Promise<boolean>;
    getConnectionInfo(): Promise<any>;
}
