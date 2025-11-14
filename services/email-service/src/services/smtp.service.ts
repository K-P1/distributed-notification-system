import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import type { EmailContent, NotificationMessage } from '../types';
import {
  CircuitBreakerService,
  WithCircuitBreaker,
} from '../infrastructure/circuit-breaker.service';
import { RetryService, WithRetry } from '../infrastructure/retry.service';

@Injectable()
export class SMTPService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly retryService: RetryService,
  ) {}

  async onModuleInit() {
    // Don't block startup if SMTP connection fails
    try {
      await this.initializeTransporter();
    } catch (error) {
      this.logger.error('smtp_init_failed_non_blocking', error as Error);
      // Continue startup even if SMTP fails
    }
  }

  private async initializeTransporter(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPassword,
        },
        pool: true,
        maxConnections: 10,
        maxMessages: 100,
      });

      // Verify connection (non-blocking)
      if (this.transporter) {
        this.transporter.verify().then(() => {
          this.logger.info('smtp_connection_verified');
        }).catch((error) => {
          this.logger.warn('smtp_verification_failed', error);
        });
      }
      this.logger.info('smtp_transporter_initialized');
    } catch (error) {
      this.logger.error('smtp_transporter_init_failed', error as Error);
      throw error;
    }
  }

  @WithCircuitBreaker('smtp_send', {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringPeriod: 10000,
  })
  @WithRetry({
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    exponentialBackoff: true,
  })
  async sendEmail(
    emailContent: EmailContent,
    correlationId: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not initialized');
    }

    const startTime = Date.now();

    try {
      this.logger.logWithCorrelation('info', 'smtp_send_start', correlationId, {
        to: emailContent.to,
        subject: emailContent.subject,
      });

      const mailOptions = {
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: emailContent.to,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        headers: {
          'X-Correlation-ID': correlationId,
        },
      };

      const info = await this.transporter.sendMail(mailOptions);

      const processingTime = Date.now() - startTime;
      this.logger.logPerformance(
        'smtp_send',
        processingTime,
        true,
        correlationId,
      );

      this.logger.logWithCorrelation(
        'info',
        'smtp_send_success',
        correlationId,
        {
          message_id: info.messageId,
          to: emailContent.to,
          processing_time_ms: processingTime,
        },
      );

      return true;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.logPerformance(
        'smtp_send',
        processingTime,
        false,
        correlationId,
      );

      this.logger.error('smtp_send_failed', error as Error, {
        to: emailContent.to,
        correlation_id: correlationId,
        processing_time_ms: processingTime,
      });

      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('smtp_health_check_failed', error as Error);
      return false;
    }
  }

  async getConnectionInfo(): Promise<any> {
    return {
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth_configured: !!(this.config.smtpUser && this.config.smtpPassword),
    };
  }
}
