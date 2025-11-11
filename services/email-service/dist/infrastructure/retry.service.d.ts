import { LoggerService } from '../utils/logger.service';
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    exponentialBackoff: boolean;
    retryableErrors?: Array<new (...args: any[]) => Error>;
}
export declare class RetryService {
    private readonly logger;
    constructor(logger: LoggerService);
    executeWithRetry<T>(operation: () => Promise<T>, config: RetryConfig, operationName: string, correlationId?: string): Promise<T>;
    private isRetryableError;
    private calculateDelay;
    private delay;
}
export declare function WithRetry(config?: Partial<RetryConfig>): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
