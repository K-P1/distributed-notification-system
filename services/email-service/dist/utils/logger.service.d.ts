export declare class LoggerService {
    private readonly logger;
    info(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
    private formatMessage;
    logWithCorrelation(level: 'info' | 'error' | 'warn' | 'debug', message: string, correlationId?: string, context?: Record<string, any>): void;
    logMetric(metricName: string, value: number, unit: string, tags?: Record<string, string>): void;
    logPerformance(operation: string, durationMs: number, success: boolean, correlationId?: string): void;
    logBusinessEvent(event: string, notificationId: string, correlationId: string, metadata?: Record<string, any>): void;
}
