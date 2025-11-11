import { Controller, Get, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database.service';
import { CacheService } from '../infrastructure/cache.service';
import { LoggerService } from '../utils/logger.service';
import { AppConfigService } from '../config/config.service';
import { TemplateRepository } from '../repositories/template.repository';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  dependencies: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      details?: any;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      details?: any;
    };
  };
  metrics: {
    templates_count: number;
    cache_hit_rate: number;
    memory_usage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

@Controller('health')
export class HealthController {
  private readonly startTime: number;

  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
    private readonly config: AppConfigService,
    private readonly templateRepository: TemplateRepository,
  ) {
    this.startTime = Date.now();
  }

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Check all dependencies in parallel
      const [databaseHealth, redisHealth, templateStats, cacheStats] =
        await Promise.allSettled([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.getTemplateStats(),
          this.getCacheStats(),
        ]);

      // Determine overall status
      const isDatabaseHealthy =
        databaseHealth.status === 'fulfilled' && databaseHealth.value.healthy;
      const isRedisHealthy =
        redisHealth.status === 'fulfilled' && redisHealth.value.healthy;

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

      if (isDatabaseHealthy && isRedisHealthy) {
        overallStatus = 'healthy';
      } else if (isDatabaseHealthy || isRedisHealthy) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'unhealthy';
      }

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp,
        version: this.config.version,
        environment: this.config.environment,
        uptime: Date.now() - this.startTime,
        dependencies: {
          database: {
            status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
            responseTime:
              databaseHealth.status === 'fulfilled'
                ? databaseHealth.value.responseTime
                : undefined,
            details:
              databaseHealth.status === 'rejected'
                ? databaseHealth.reason?.message
                : undefined,
          },
          redis: {
            status: isRedisHealthy ? 'healthy' : 'unhealthy',
            responseTime:
              redisHealth.status === 'fulfilled'
                ? redisHealth.value.responseTime
                : undefined,
            details:
              redisHealth.status === 'rejected'
                ? redisHealth.reason?.message
                : undefined,
          },
        },
        metrics: {
          templates_count:
            templateStats.status === 'fulfilled'
              ? templateStats.value.total
              : 0,
          cache_hit_rate:
            cacheStats.status === 'fulfilled' ? cacheStats.value.hitRate : 0,
          memory_usage: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          },
        },
      };

      const responseTime = Date.now() - startTime;

      // Log health check
      this.logger.info('health_check_completed', {
        status: overallStatus,
        responseTime,
        dependencies: {
          database: isDatabaseHealthy,
          redis: isRedisHealthy,
        },
      });

      return healthStatus;
    } catch (error) {
      this.logger.error('health_check_failed', error as Error);

      return {
        status: 'unhealthy',
        timestamp,
        version: this.config.version,
        environment: this.config.environment,
        uptime: Date.now() - this.startTime,
        dependencies: {
          database: {
            status: 'unhealthy',
            details: 'Health check failed',
          },
          redis: {
            status: 'unhealthy',
            details: 'Health check failed',
          },
        },
        metrics: {
          templates_count: 0,
          cache_hit_rate: 0,
          memory_usage: {
            used: 0,
            total: 0,
            percentage: 0,
          },
        },
      };
    }
  }

  @Get('ready')
  async getReadiness(): Promise<{ ready: boolean; timestamp: string }> {
    const timestamp = new Date().toISOString();

    try {
      // Check critical dependencies for readiness
      const [databaseReady, redisReady] = await Promise.allSettled([
        this.database.checkHealth(),
        this.cache.checkHealth(),
      ]);

      const ready =
        databaseReady.status === 'fulfilled' &&
        databaseReady.value &&
        redisReady.status === 'fulfilled' &&
        redisReady.value;

      this.logger.info('readiness_check_completed', {
        ready,
        database:
          databaseReady.status === 'fulfilled' ? databaseReady.value : false,
        redis: redisReady.status === 'fulfilled' ? redisReady.value : false,
      });

      return { ready, timestamp };
    } catch (error) {
      this.logger.error('readiness_check_failed', error as Error);
      return { ready: false, timestamp };
    }
  }

  @Get('live')
  async getLiveness(): Promise<{
    alive: boolean;
    timestamp: string;
    uptime: number;
  }> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    // Liveness is simple - if we can respond, we're alive
    return {
      alive: true,
      timestamp,
      uptime,
    };
  }

  private async checkDatabaseHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.database.checkHealth();
      const responseTime = Date.now() - startTime;

      return {
        healthy: isHealthy,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('database_health_check_failed', error as Error);

      return {
        healthy: false,
        responseTime,
      };
    }
  }

  private async checkRedisHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.cache.checkHealth();
      const responseTime = Date.now() - startTime;

      return {
        healthy: isHealthy,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('redis_health_check_failed', error as Error);

      return {
        healthy: false,
        responseTime,
      };
    }
  }

  private async getTemplateStats(): Promise<{ total: number; active: number }> {
    try {
      const stats = await this.templateRepository.getTemplateStats();
      return {
        total: stats.total,
        active: stats.active,
      };
    } catch (error) {
      this.logger.error('template_stats_failed', error as Error);
      return {
        total: 0,
        active: 0,
      };
    }
  }

  private async getCacheStats(): Promise<{ hitRate: number; size: number }> {
    try {
      const stats = this.cache.getStats();
      return {
        hitRate: stats.hitRate,
        size: stats.size,
      };
    } catch (error) {
      this.logger.error('cache_stats_failed', error as Error);
      return {
        hitRate: 0,
        size: 0,
      };
    }
  }
}
