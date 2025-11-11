import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { NotificationStatus, type StatusUpdate } from '../types';
import {
  CircuitBreakerService,
  WithCircuitBreaker,
} from '../infrastructure/circuit-breaker.service';
import { RetryService, WithRetry } from '../infrastructure/retry.service';

@Injectable()
export class StatusUpdateService {
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly retryService: RetryService,
  ) {}

  @WithCircuitBreaker('status_update', {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    monitoringPeriod: 10000,
  })
  @WithRetry({
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBackoff: true,
  })
  async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    correlationId: string,
    error?: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      this.logger.logWithCorrelation(
        'info',
        'status_update_start',
        correlationId,
        {
          notification_id: notificationId,
          status,
        },
      );

      const statusUpdate: StatusUpdate = {
        notification_id: notificationId,
        status,
        timestamp: new Date().toISOString(),
        error,
        metadata,
      };

      const response = await axios.post(
        `${this.config.apiGatewayUrl}/api/v1/email/status/`,
        statusUpdate,
        {
          timeout: this.config.apiGatewayTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
        },
      );

      if (response.status >= 200 && response.status < 300) {
        const processingTime = Date.now() - startTime;
        this.logger.logPerformance(
          'status_update',
          processingTime,
          true,
          correlationId,
        );

        this.logger.logWithCorrelation(
          'info',
          'status_update_success',
          correlationId,
          {
            notification_id: notificationId,
            status,
            processing_time_ms: processingTime,
          },
        );

        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.logPerformance(
        'status_update',
        processingTime,
        false,
        correlationId,
      );

      this.logger.error('status_update_failed', error as Error, {
        notification_id: notificationId,
        status,
        correlation_id: correlationId,
        processing_time_ms: processingTime,
      });

      throw error;
    }
  }

  async updateProcessingStatus(
    notificationId: string,
    correlationId: string,
  ): Promise<boolean> {
    return this.updateNotificationStatus(
      notificationId,
      NotificationStatus.PROCESSING,
      correlationId,
    );
  }

  async updateDeliveredStatus(
    notificationId: string,
    correlationId: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    return this.updateNotificationStatus(
      notificationId,
      NotificationStatus.DELIVERED,
      correlationId,
      undefined,
      metadata,
    );
  }

  async updateFailedStatus(
    notificationId: string,
    correlationId: string,
    error: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    return this.updateNotificationStatus(
      notificationId,
      NotificationStatus.FAILED,
      correlationId,
      error,
      metadata,
    );
  }

  async checkApiGatewayHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.apiGatewayUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error('api_gateway_health_check_failed', error as Error);
      return false;
    }
  }
}
