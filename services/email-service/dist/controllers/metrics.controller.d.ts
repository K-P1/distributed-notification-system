import { EmailProcessor } from '../services/email-processor.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { LoggerService } from '../utils/logger.service';
export declare class MetricsController {
    private readonly emailProcessor;
    private readonly circuitBreakerService;
    private readonly logger;
    constructor(emailProcessor: EmailProcessor, circuitBreakerService: CircuitBreakerService, logger: LoggerService);
    getMetrics(): {
        service: string;
        timestamp: string;
        processing: {
            is_processing: boolean;
            processed_count: number;
            failed_count: number;
            success_rate: number;
            circuit_breakers: Record<string, any>;
        };
        circuit_breakers: Record<string, any>;
        uptime: number;
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
    };
    getProcessingMetrics(): {
        is_processing: boolean;
        processed_count: number;
        failed_count: number;
        success_rate: number;
        circuit_breakers: Record<string, any>;
    };
    getCircuitBreakerMetrics(): Record<string, any>;
    resetMetrics(body: {
        type?: string;
    }): {
        success: boolean;
        message: string;
        reset_types: string[];
        timestamp: string;
        error?: undefined;
    } | {
        success: boolean;
        message: string;
        error: string;
        reset_types?: undefined;
        timestamp?: undefined;
    };
}
