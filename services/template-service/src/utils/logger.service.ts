import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger();

  info(message: string, context?: Record<string, any>) {
    this.logger.log(this.formatMessage(message, context));
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    const errorInfo = error
      ? {
          error: error.message,
          stack: error.stack,
          name: error.name,
        }
      : undefined;

    this.logger.error(
      this.formatMessage(message, { ...context, ...errorInfo }),
    );
  }

  warn(message: string, context?: Record<string, any>) {
    this.logger.warn(this.formatMessage(message, context));
  }

  debug(message: string, context?: Record<string, any>) {
    this.logger.debug(this.formatMessage(message, context));
  }

  private formatMessage(
    message: string,
    context?: Record<string, any>,
  ): string {
    if (!context) return message;

    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      message,
      service: 'template-service',
      ...context,
    };

    return JSON.stringify(logObject);
  }

  // Correlation ID aware logging
  logWithCorrelation(
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string,
    correlationId?: string,
    context?: Record<string, any>,
  ) {
    const logContext = {
      correlation_id: correlationId,
      ...context,
    };

    switch (level) {
      case 'info':
        this.info(message, logContext);
        break;
      case 'error':
        this.error(message, undefined, logContext);
        break;
      case 'warn':
        this.warn(message, logContext);
        break;
      case 'debug':
        this.debug(message, logContext);
        break;
    }
  }

  // Performance logging
  logPerformance(
    operation: string,
    durationMs: number,
    success: boolean,
    correlationId?: string,
    context?: Record<string, any>,
  ) {
    this.info('performance', {
      operation,
      duration_ms: durationMs,
      success,
      correlation_id: correlationId,
      ...context,
    });
  }

  // Metrics logging
  logMetric(
    metricName: string,
    value: number,
    unit: string,
    tags?: Record<string, string>,
    correlationId?: string,
  ) {
    this.info('metric', {
      metric_name: metricName,
      value,
      unit,
      tags,
      correlation_id: correlationId,
    });
  }

  // Business event logging
  logBusinessEvent(
    event: string,
    templateId: string,
    correlationId: string,
    metadata?: Record<string, any>,
  ) {
    this.info('business_event', {
      event,
      template_id: templateId,
      correlation_id: correlationId,
      ...metadata,
    });
  }

  // Cache logging
  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    correlationId?: string,
    metadata?: Record<string, any>,
  ) {
    this.info('cache_operation', {
      operation,
      cache_key: key,
      correlation_id: correlationId,
      ...metadata,
    });
  }

  // Database logging
  logDatabaseOperation(
    operation: string,
    table: string,
    durationMs: number,
    success: boolean,
    correlationId?: string,
    context?: Record<string, any>,
  ) {
    this.info('database_operation', {
      operation,
      table,
      duration_ms: durationMs,
      success,
      correlation_id: correlationId,
      ...context,
    });
  }
}
