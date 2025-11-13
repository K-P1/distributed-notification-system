import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../utils/logger.service';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: Array<new (...args: any[]) => Error>;
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private circuits = new Map<string, CircuitBreaker>();

  constructor(private readonly logger: LoggerService) {}

  createCircuit(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (this.circuits.has(name)) {
      return this.circuits.get(name)!;
    }

    const circuit = new CircuitBreaker(name, config, this.logger);
    this.circuits.set(name, circuit);
    return circuit;
  }

  getCircuit(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  getCircuitStats(name: string): any {
    const circuit = this.circuits.get(name);
    return circuit ? circuit.getStats() : null;
  }

  getAllCircuitStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.circuits.forEach((circuit, name) => {
      stats[name] = circuit.getStats();
    });
    return stats;
  }

  onModuleDestroy() {
    this.circuits.forEach((circuit) => circuit.destroy());
    this.circuits.clear();
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastRequestTime: number = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
    private readonly logger: LoggerService,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    correlationId?: string,
  ): Promise<T> {
    this.totalRequests++;
    this.lastRequestTime = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.logWithCorrelation(
          'info',
          'circuit_breaker_half_open',
          correlationId,
          { circuit: this.name },
        );
      } else {
        const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
        this.logger.logWithCorrelation(
          'warn',
          'circuit_breaker_rejected',
          correlationId,
          { circuit: this.name, state: this.state },
        );
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess(correlationId);
      return result;
    } catch (error) {
      this.onFailure(error as Error, correlationId);
      throw error;
    }
  }

  private onSuccess(correlationId?: string): void {
    this.failures = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.logger.logWithCorrelation(
        'info',
        'circuit_breaker_closed',
        correlationId,
        { circuit: this.name },
      );
    }
  }

  private onFailure(error: Error, correlationId?: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.shouldOpenCircuit(error)) {
      this.state = CircuitState.OPEN;
      this.logger.logWithCorrelation(
        'error',
        'circuit_breaker_opened',
        correlationId,
        {
          circuit: this.name,
          failures: this.failures,
          threshold: this.config.failureThreshold,
          error: error.message,
        },
      );
    }
  }

  private shouldOpenCircuit(error: Error): boolean {
    if (this.state === CircuitState.OPEN) {
      return false;
    }

    if (this.config.expectedErrors) {
      const isExpectedError = this.config.expectedErrors.some(
        (ExpectedError) => error instanceof ExpectedError,
      );
      if (!isExpectedError) {
        return false;
      }
    }

    return this.failures >= this.config.failureThreshold;
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      successRate:
        this.totalRequests > 0 ? this.successCount / this.totalRequests : 0,
      lastFailureTime: this.lastFailureTime,
      lastRequestTime: this.lastRequestTime,
      config: this.config,
    };
  }

  destroy(): void {
    // Cleanup if needed
  }
}
