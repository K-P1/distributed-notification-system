import { Injectable } from '@nestjs/common';
import { LoggerService } from '../utils/logger.service';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  retryableErrors?: Array<new (...args: any[]) => Error>;
}

@Injectable()
export class RetryService {
  constructor(private readonly logger: LoggerService) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    operationName: string,
    correlationId?: string,
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        if (attempt > 0) {
          this.logger.logWithCorrelation(
            'info',
            'retry_attempt',
            correlationId,
            {
              operation: operationName,
              attempt,
              max_retries: config.maxRetries,
            },
          );
        }

        const result = await operation();

        if (attempt > 0) {
          this.logger.logWithCorrelation(
            'info',
            'retry_success',
            correlationId,
            {
              operation: operationName,
              attempt,
              max_retries: config.maxRetries,
            },
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (!this.isRetryableError(lastError, config)) {
          this.logger.logWithCorrelation(
            'error',
            'non_retryable_error',
            correlationId,
            {
              operation: operationName,
              attempt,
              error: lastError.message,
            },
          );
          throw lastError;
        }

        // If we've exhausted retries, throw the last error
        if (attempt > config.maxRetries) {
          this.logger.logWithCorrelation(
            'error',
            'retry_exhausted',
            correlationId,
            {
              operation: operationName,
              attempts: attempt,
              max_retries: config.maxRetries,
              error: lastError.message,
            },
          );
          throw lastError;
        }

        // Calculate delay for next retry
        const delayMs = this.calculateDelay(attempt - 1, config);

        this.logger.logWithCorrelation('warn', 'retry_failure', correlationId, {
          operation: operationName,
          attempt,
          max_retries: config.maxRetries,
          delay_ms: delayMs,
          error: lastError.message,
        });

        // Wait before retrying
        await this.delay(delayMs);
      }
    }

    // This should never be reached, but just in case
    throw lastError!;
  }

  private isRetryableError(error: Error, config: RetryConfig): boolean {
    if (!config.retryableErrors || config.retryableErrors.length === 0) {
      // If no specific retryable errors defined, retry all errors
      return true;
    }

    return config.retryableErrors.some(
      (RetryableError) => error instanceof RetryableError,
    );
  }

  private calculateDelay(attemptNumber: number, config: RetryConfig): number {
    if (!config.exponentialBackoff) {
      return config.initialDelayMs;
    }

    // Exponential backoff: delay = initialDelay * 2^attempt
    const exponentialDelay = config.initialDelayMs * Math.pow(2, attemptNumber);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const totalDelay = exponentialDelay + jitter;

    // Respect maximum delay
    return Math.min(totalDelay, config.maxDelayMs);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Decorator for retry logic
export function WithRetry(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const operationName = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const retryService: RetryService = this.retryService;
      if (!retryService) {
        throw new Error('RetryService not injected');
      }

      const retryConfig: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        exponentialBackoff: true,
        ...config,
      };

      const correlationId = args.find(
        (arg) => arg?.correlationId,
      )?.correlationId;

      return retryService.executeWithRetry(
        () => method.apply(this, args),
        retryConfig,
        operationName,
        correlationId,
      );
    };
  };
}
