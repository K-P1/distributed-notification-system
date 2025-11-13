import { OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../utils/logger.service';
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    expectedErrors?: Array<new (...args: any[]) => Error>;
}
export declare class CircuitBreakerService implements OnModuleDestroy {
    private readonly logger;
    private circuits;
    constructor(logger: LoggerService);
    createCircuit(name: string, config: CircuitBreakerConfig): CircuitBreaker;
    getCircuit(name: string): CircuitBreaker | undefined;
    getCircuitStats(name: string): any;
    getAllCircuitStats(): Record<string, any>;
    onModuleDestroy(): void;
}
export declare class CircuitBreaker {
    private readonly name;
    private readonly config;
    private readonly logger;
    private state;
    private failures;
    private lastFailureTime;
    private successCount;
    private totalRequests;
    private lastRequestTime;
    constructor(name: string, config: CircuitBreakerConfig, logger: LoggerService);
    execute<T>(operation: () => Promise<T>, correlationId?: string): Promise<T>;
    private onSuccess;
    private onFailure;
    private shouldOpenCircuit;
    private shouldAttemptReset;
    getStats(): {
        name: string;
        state: CircuitState;
        failures: number;
        successCount: number;
        totalRequests: number;
        successRate: number;
        lastFailureTime: number;
        lastRequestTime: number;
        config: CircuitBreakerConfig;
    };
    destroy(): void;
}
export declare function WithCircuitBreaker(circuitName: string, config?: Partial<CircuitBreakerConfig>): (target: any, propertyName: string, descriptor: PropertyDescriptor) => void;
