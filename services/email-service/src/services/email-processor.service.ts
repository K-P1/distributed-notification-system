import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { RabbitMQService } from '../infrastructure/rabbitmq.service';
import { SMTPService } from './smtp.service';
import { TemplateRenderer } from './template-renderer.service';
import { StatusUpdateService } from './status-update.service';
import type { NotificationMessage } from '../types';
import { NotificationStatus } from '../types';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';

@Injectable()
export class EmailProcessor implements OnModuleInit {
  private isProcessing = false;
  private processedCount = 0;
  private failedCount = 0;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly smtpService: SMTPService,
    private readonly templateRenderer: TemplateRenderer,
    private readonly statusUpdateService: StatusUpdateService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    // Start consuming messages from the email queue (non-blocking)
    this.startProcessing().catch(error => {
      this.logger.error('email_processor_init_failed', error as Error);
      // Don't crash the app if email processor fails to start
    });
  }

  private async startProcessing(): Promise<void> {
    try {
      this.logger.info('email_processor_starting');

      this.isProcessing = true;

      // Start consuming from email queue
      await this.rabbitmqService.consume(
        this.config.emailQueueName,
        this.processEmailMessage.bind(this),
      );

      this.logger.info('email_processor_started', {
        queue: this.config.emailQueueName,
      });
    } catch (error) {
      this.logger.error('email_processor_start_failed', error as Error);
      this.isProcessing = false;
      throw error;
    }
  }

  private async processEmailMessage(
    message: NotificationMessage,
    correlationId: string,
  ): Promise<void> {
    const startTime = Date.now();
    const notificationId = message.notification_id;

    try {
      this.logger.logBusinessEvent(
        'email_processing_start',
        notificationId,
        correlationId,
        {
          user_id: message.user_id,
          template_code: message.template_code,
          priority: message.priority,
        },
      );

      // Update status to processing
      await this.statusUpdateService.updateProcessingStatus(
        notificationId,
        correlationId,
      );

      // Validate user preferences
      if (!this.validateUserPreferences(message)) {
        throw new Error('User has disabled email notifications');
      }

      // Validate template
      if (!this.templateRenderer.validateTemplate(message.template_data)) {
        throw new Error('Invalid template data');
      }

      // Render email content from template
      const emailContent = await this.templateRenderer.renderEmailTemplate(
        message,
        correlationId,
      );

      // Send email via SMTP
      const success = await this.smtpService.sendEmail(
        emailContent,
        correlationId,
      );

      if (success) {
        // Update status to delivered
        await this.statusUpdateService.updateDeliveredStatus(
          notificationId,
          correlationId,
          {
            delivery_method: 'smtp',
            recipient: emailContent.to,
            subject: emailContent.subject,
          },
        );

        this.processedCount++;
        const processingTime = Date.now() - startTime;

        this.logger.logBusinessEvent(
          'email_processing_success',
          notificationId,
          correlationId,
          {
            user_id: message.user_id,
            template_code: message.template_code,
            recipient: emailContent.to,
            processing_time_ms: processingTime,
          },
        );

        this.logger.logMetric('email_processed', 1, 'count', {
          status: 'success',
          template_code: message.template_code,
        });
      } else {
        throw new Error('SMTP send returned false');
      }
    } catch (error) {
      this.failedCount++;
      const processingTime = Date.now() - startTime;

      this.logger.logBusinessEvent(
        'email_processing_failed',
        notificationId,
        correlationId,
        {
          user_id: message.user_id,
          template_code: message.template_code,
          error: (error as Error).message,
          processing_time_ms: processingTime,
        },
      );

      // Update status to failed
      try {
        await this.statusUpdateService.updateFailedStatus(
          notificationId,
          correlationId,
          (error as Error).message,
          {
            failure_stage: this.determineFailureStage(error as Error),
            template_code: message.template_code,
          },
        );
      } catch (statusError) {
        this.logger.error(
          'status_update_after_failure_failed',
          statusError as Error,
          {
            notification_id: notificationId,
            correlation_id: correlationId,
          },
        );
      }

      this.logger.logMetric('email_processed', 1, 'count', {
        status: 'failed',
        template_code: message.template_code,
      });

      // Re-throw to trigger message rejection
      throw error;
    }
  }

  private validateUserPreferences(message: NotificationMessage): boolean {
    try {
      const { user_data } = message;

      // Check if user has email enabled
      if (!user_data.preferences.email) {
        this.logger.logWithCorrelation('warn', 'email_disabled_by_user', '', {
          user_id: user_data.id,
          notification_id: message.notification_id,
        });
        return false;
      }

      // Check if user has valid email
      if (!user_data.email || !this.isValidEmail(user_data.email)) {
        this.logger.logWithCorrelation('warn', 'invalid_user_email', '', {
          user_id: user_data.id,
          notification_id: message.notification_id,
          email: user_data.email,
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('user_preference_validation_failed', error as Error, {
        notification_id: message.notification_id,
        user_id: message.user_id,
      });
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private determineFailureStage(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('template') || errorMessage.includes('render')) {
      return 'template_rendering';
    } else if (errorMessage.includes('smtp') || errorMessage.includes('mail')) {
      return 'smtp_delivery';
    } else if (
      errorMessage.includes('user') ||
      errorMessage.includes('preference')
    ) {
      return 'user_validation';
    } else if (
      errorMessage.includes('status') ||
      errorMessage.includes('update')
    ) {
      return 'status_update';
    } else {
      return 'unknown';
    }
  }

  // Health check and metrics methods
  getProcessingStats() {
    return {
      is_processing: this.isProcessing,
      processed_count: this.processedCount,
      failed_count: this.failedCount,
      success_rate:
        this.processedCount + this.failedCount > 0
          ? this.processedCount / (this.processedCount + this.failedCount)
          : 0,
      circuit_breakers: this.circuitBreakerService.getAllCircuitStats(),
    };
  }

  resetCounters(): void {
    this.processedCount = 0;
    this.failedCount = 0;
  }
}
