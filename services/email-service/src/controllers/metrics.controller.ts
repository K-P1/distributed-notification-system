import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmailProcessor } from '../services/email-processor.service';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { LoggerService } from '../utils/logger.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly emailProcessor: EmailProcessor,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly logger: LoggerService,
  ) {}

  @Get()
  getMetrics() {
    const processingStats = this.emailProcessor.getProcessingStats();
    const circuitStats = this.circuitBreakerService.getAllCircuitStats();

    return {
      service: 'email-service',
      timestamp: new Date().toISOString(),
      processing: processingStats,
      circuit_breakers: circuitStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  }

  @Get('processing')
  getProcessingMetrics() {
    return this.emailProcessor.getProcessingStats();
  }

  @Get('circuit-breakers')
  getCircuitBreakerMetrics() {
    return this.circuitBreakerService.getAllCircuitStats();
  }

  @Post('reset')
  resetMetrics(@Body() body: { type?: string }) {
    const { type } = body;

    try {
      if (!type || type === 'processing') {
        this.emailProcessor.resetCounters();
        this.logger.info('processing_metrics_reset');
      }

      return {
        success: true,
        message: 'Metrics reset successfully',
        reset_types: type ? [type] : ['processing'],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('metrics_reset_failed', error as Error);
      return {
        success: false,
        message: 'Failed to reset metrics',
        error: (error as Error).message,
      };
    }
  }
}
