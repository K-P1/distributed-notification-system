import { Controller, Get, Query } from '@nestjs/common';
import { CircuitBreakerService } from '../infrastructure/circuit-breaker.service';
import { CacheService } from '../infrastructure/cache.service';
import { DatabaseService } from '../infrastructure/database.service';
import { TemplateRepository } from '../repositories/template.repository';
import { LoggerService } from '../utils/logger.service';

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  eventLoop: {
    delay: number;
  };
}

interface ApplicationMetrics {
  timestamp: string;
  templates: {
    total: number;
    active: number;
    inactive: number;
    byType: Record<string, number>;
    byLanguage: Record<string, number>;
    recentlyCreated: number; // Last 24h
    recentlyUpdated: number; // Last 24h
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    memoryUsage: number;
  };
  circuitBreakers: Record<
    string,
    {
      state: string;
      failures: number;
      successRate: number;
      lastFailure: string | null;
    }
  >;
}

interface PerformanceMetrics {
  timestamp: string;
  requestCounts: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  responseTimes: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  database: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number; // > 1s
    connectionPoolSize: number;
    activeConnections: number;
  };
}

@Controller('metrics')
export class MetricsController {
  private readonly startTime: number;
  private readonly requestMetrics: Map<string, number[]> = new Map();

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly cache: CacheService,
    private readonly database: DatabaseService,
    private readonly templateRepository: TemplateRepository,
    private readonly logger: LoggerService,
  ) {
    this.startTime = Date.now();
  }

  @Get('system')
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Simple event loop delay measurement
    const eventLoopStart = process.hrtime.bigint();
    await new Promise((resolve) => setImmediate(resolve));
    const eventLoopDelay =
      Number(process.hrtime.bigint() - eventLoopStart) / 1000000; // ms

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      cpu: {
        user: cpuUsage.user / 1000, // Convert to milliseconds
        system: cpuUsage.system / 1000,
      },
      eventLoop: {
        delay: eventLoopDelay,
      },
    };
  }

  @Get('application')
  async getApplicationMetrics(): Promise<ApplicationMetrics> {
    try {
      const [templateStats, cacheStats, circuitBreakerStats] =
        await Promise.all([
          this.getTemplateMetrics(),
          this.getCacheMetrics(),
          this.getCircuitBreakerMetrics(),
        ]);

      return {
        timestamp: new Date().toISOString(),
        templates: templateStats,
        cache: cacheStats,
        circuitBreakers: circuitBreakerStats,
      };
    } catch (error) {
      this.logger.error('application_metrics_failed', error as Error);
      throw error;
    }
  }

  @Get('performance')
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [requestMetrics, databaseMetrics] = await Promise.all([
        this.getRequestMetrics(),
        this.getDatabaseMetrics(),
      ]);

      return {
        timestamp: new Date().toISOString(),
        requestCounts: requestMetrics.counts,
        responseTimes: requestMetrics.responseTimes,
        database: databaseMetrics,
      };
    } catch (error) {
      this.logger.error('performance_metrics_failed', error as Error);
      throw error;
    }
  }

  @Get('all')
  async getAllMetrics(): Promise<{
    system: SystemMetrics;
    application: ApplicationMetrics;
    performance: PerformanceMetrics;
  }> {
    const [systemMetrics, applicationMetrics, performanceMetrics] =
      await Promise.all([
        this.getSystemMetrics(),
        this.getApplicationMetrics(),
        this.getPerformanceMetrics(),
      ]);

    return {
      system: systemMetrics,
      application: applicationMetrics,
      performance: performanceMetrics,
    };
  }

  @Get('prometheus')
  async getPrometheusMetrics(): Promise<string> {
    try {
      const [systemMetrics, applicationMetrics] = await Promise.all([
        this.getSystemMetrics(),
        this.getApplicationMetrics(),
      ]);

      const metrics: string[] = [
        '# HELP template_service_uptime_seconds Total uptime of the service in seconds',
        '# TYPE template_service_uptime_seconds counter',
        `template_service_uptime_seconds ${(systemMetrics.uptime / 1000).toFixed(2)}`,
        '',
        '# HELP template_service_memory_usage_bytes Memory usage in bytes',
        '# TYPE template_service_memory_usage_bytes gauge',
        `template_service_memory_usage_bytes{type="heap_used"} ${systemMetrics.memory.used}`,
        `template_service_memory_usage_bytes{type="heap_total"} ${systemMetrics.memory.total}`,
        `template_service_memory_usage_bytes{type="rss"} ${systemMetrics.memory.rss}`,
        '',
        '# HELP template_service_templates_total Total number of templates',
        '# TYPE template_service_templates_total gauge',
        `template_service_templates_total{status="total"} ${applicationMetrics.templates.total}`,
        `template_service_templates_total{status="active"} ${applicationMetrics.templates.active}`,
        `template_service_templates_total{status="inactive"} ${applicationMetrics.templates.inactive}`,
        '',
        '# HELP template_service_cache_operations_total Total number of cache operations',
        '# TYPE template_service_cache_operations_total counter',
        `template_service_cache_operations_total{result="hit"} ${applicationMetrics.cache.hits}`,
        `template_service_cache_operations_total{result="miss"} ${applicationMetrics.cache.misses}`,
        '',
        '# HELP template_service_cache_hit_rate Cache hit rate as a percentage',
        '# TYPE template_service_cache_hit_rate gauge',
        `template_service_cache_hit_rate ${applicationMetrics.cache.hitRate}`,
        '',
      ];

      // Add template type metrics
      for (const [type, count] of Object.entries(
        applicationMetrics.templates.byType,
      )) {
        metrics.push(
          `template_service_templates_by_type{type="${type}"} ${count}`,
        );
      }

      // Add circuit breaker metrics
      for (const [name, stats] of Object.entries(
        applicationMetrics.circuitBreakers,
      )) {
        metrics.push('');
        metrics.push(
          `# HELP template_service_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)`,
        );
        metrics.push(`# TYPE template_service_circuit_breaker_state gauge`);

        const stateValue =
          stats.state === 'CLOSED' ? 0 : stats.state === 'OPEN' ? 1 : 2;
        metrics.push(
          `template_service_circuit_breaker_state{name="${name}"} ${stateValue}`,
        );

        metrics.push(
          `template_service_circuit_breaker_failures{name="${name}"} ${stats.failures}`,
        );
        metrics.push(
          `template_service_circuit_breaker_success_rate{name="${name}"} ${stats.successRate}`,
        );
      }

      return metrics.join('\n');
    } catch (error) {
      this.logger.error('prometheus_metrics_failed', error as Error);
      return '# Error generating metrics\n';
    }
  }

  private async getTemplateMetrics() {
    const stats = await this.templateRepository.getTemplateStats();

    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.total - stats.active,
      byType: stats.byType,
      byLanguage: stats.byLanguage,
      recentlyCreated: 0, // Would need additional query
      recentlyUpdated: 0, // Would need additional query
    };
  }

  private async getCacheMetrics() {
    const stats = await this.cache.getStats();

    return {
      hits: stats.hits,
      misses: stats.misses,
      size: stats.size,
      hitRate: stats.hitRate,
      memoryUsage: 0, // Would need Redis memory info
    };
  }

  private async getCircuitBreakerMetrics(): Promise<Record<string, any>> {
    // This would need to be implemented in the CircuitBreakerService
    // For now, return empty object
    return {};
  }

  private async getRequestMetrics() {
    // This would typically come from middleware that tracks requests
    // For now, return mock data
    return {
      counts: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 100,
      },
      responseTimes: {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
    };
  }

  private async getDatabaseMetrics() {
    const connectionInfo = this.database.getConnectionInfo();

    return {
      totalQueries: 0, // Would need query tracking
      averageQueryTime: 0, // Would need query tracking
      slowQueries: 0, // Would need query tracking
      connectionPoolSize: connectionInfo.pool_size || 0,
      activeConnections:
        (connectionInfo.pool_size || 0) -
        (connectionInfo.idle_connections || 0),
    };
  }

  // Helper method to record request metrics (would be called by middleware)
  recordRequestMetrics(
    endpoint: string,
    responseTime: number,
    success: boolean,
  ) {
    const key = `${endpoint}:${success ? 'success' : 'error'}`;
    const times = this.requestMetrics.get(key) || [];
    times.push(responseTime);

    // Keep only last 1000 measurements
    if (times.length > 1000) {
      times.splice(0, times.length - 1000);
    }

    this.requestMetrics.set(key, times);
  }
}
