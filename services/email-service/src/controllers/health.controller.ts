import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { RabbitMQService } from '../infrastructure/rabbitmq.service';
import { SMTPService } from '../services/smtp.service';
import { StatusUpdateService } from '../services/status-update.service';
import { EmailProcessor } from '../services/email-processor.service';
import type { HealthCheck } from '../types';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly smtpService: SMTPService,
    private readonly statusUpdateService: StatusUpdateService,
    private readonly emailProcessor: EmailProcessor,
  ) {}

  @Get()
  async checkHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Check all dependencies
      const [rabbitmqHealth, smtpHealth, apiGatewayHealth] =
        await Promise.allSettled([
          this.rabbitmqService.checkHealth(),
          this.smtpService.checkHealth(),
          this.statusUpdateService.checkApiGatewayHealth(),
        ]);

      const dependencies = {
        rabbitmq: this.getHealthStatus(rabbitmqHealth),
        smtp: this.getHealthStatus(smtpHealth),
        redis: 'healthy' as const, // Redis check would go here
        template_service: 'healthy' as const, // Template service check would go here
        api_gateway: this.getHealthStatus(apiGatewayHealth),
      };

      // Get processing metrics
      const processingStats = this.emailProcessor.getProcessingStats();

      // Get queue information
      const queueInfo = await this.rabbitmqService.getQueueInfo(
        this.config.emailQueueName,
      );

      const metrics = {
        messages_processed: processingStats.processed_count,
        messages_failed: processingStats.failed_count,
        average_processing_time: 0, // Would need to track this
        queue_length: queueInfo?.messageCount || 0,
      };

      const overallStatus = this.determineOverallStatus(dependencies);

      const healthCheck: HealthCheck = {
        status: overallStatus,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        dependencies,
        metrics,
      };

      const checkTime = Date.now() - startTime;
      this.logger.logPerformance(
        'health_check',
        checkTime,
        overallStatus === 'healthy',
        'health_check',
      );

      return healthCheck;
    } catch (error) {
      const checkTime = Date.now() - startTime;
      this.logger.error('health_check_failed', error as Error);
      this.logger.logPerformance(
        'health_check',
        checkTime,
        false,
        'health_check',
      );

      return {
        status: 'unhealthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        dependencies: {
          rabbitmq: 'unhealthy',
          smtp: 'unhealthy',
          redis: 'unhealthy',
          template_service: 'unhealthy',
          api_gateway: 'unhealthy',
        },
        metrics: {
          messages_processed: 0,
          messages_failed: 0,
          average_processing_time: 0,
          queue_length: 0,
        },
      };
    }
  }

  @Get('detailed')
  async getDetailedHealth() {
    const healthCheck = await this.checkHealth();
    const processingStats = this.emailProcessor.getProcessingStats();

    return {
      ...healthCheck,
      service_details: {
        name: 'email-service',
        environment: this.config.environment,
        port: this.config.port,
        processing_stats: processingStats,
        smtp_config: await this.smtpService.getConnectionInfo(),
      },
    };
  }

  private getHealthStatus(
    result: PromiseSettledResult<boolean>,
  ): 'healthy' | 'unhealthy' {
    if (result.status === 'fulfilled' && result.value === true) {
      return 'healthy';
    }
    return 'unhealthy';
  }

  private determineOverallStatus(
    dependencies: Record<string, 'healthy' | 'unhealthy'>,
  ): 'healthy' | 'unhealthy' {
    // Service is healthy if critical dependencies are healthy
    const criticalDependencies = ['rabbitmq', 'smtp'];

    for (const dep of criticalDependencies) {
      if (dependencies[dep] === 'unhealthy') {
        return 'unhealthy';
      }
    }

    return 'healthy';
  }
}
