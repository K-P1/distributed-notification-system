import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import type { Template, CacheStatistics } from '../types';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 0,
    hitRate: 0,
  };

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.client = createClient({
      url: this.config.redisUrl,
    });

    this.client.on('error', (error) => {
      this.logger.error('redis_connection_error', error);
    });

    this.client.on('connect', () => {
      this.logger.info('redis_connected');
    });

    this.client.on('disconnect', () => {
      this.logger.warn('redis_disconnected');
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.stats.maxSize = this.config.templateCacheMaxSize;
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  async get<T>(key: string, correlationId?: string): Promise<T | null> {
    const circuitBreaker = this.circuitBreakerService.createCircuit(
      'redis_get',
      {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
      },
    );

    try {
      const result = await circuitBreaker.execute(async () => {
        const startTime = Date.now();
        const value = await this.client.get(key);

        const duration = Date.now() - startTime;
        this.logger.logPerformance('cache_get', duration, true, correlationId);

        if (value && typeof value === 'string') {
          this.stats.hits++;
          this.logger.logCacheOperation('hit', key, correlationId);
          return JSON.parse(value) as T;
        } else {
          this.stats.misses++;
          this.logger.logCacheOperation('miss', key, correlationId);
          return null;
        }
      }, correlationId);

      this.updateHitRate();
      return result;
    } catch (error) {
      this.stats.misses++;
      this.logger.error('cache_get_failed', error as Error, {
        key,
        correlation_id: correlationId,
      });
      this.updateHitRate();
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    correlationId?: string,
  ): Promise<boolean> {
    const circuitBreaker = this.circuitBreakerService.createCircuit(
      'redis_set',
      {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
      },
    );

    try {
      const result = await circuitBreaker.execute(async () => {
        const startTime = Date.now();
        const serializedValue = JSON.stringify(value);
        const ttl = ttlSeconds || this.config.templateCacheTtl;

        await this.client.setEx(key, ttl, serializedValue);

        const duration = Date.now() - startTime;
        this.logger.logPerformance('cache_set', duration, true, correlationId);

        return true;
      }, correlationId);

      this.logger.logCacheOperation('set', key, correlationId, {
        ttl_seconds: ttlSeconds || this.config.templateCacheTtl,
      });

      this.stats.size = Math.min(this.stats.size + 1, this.stats.maxSize);
      return result;
    } catch (error) {
      this.logger.error('cache_set_failed', error as Error, {
        key,
        correlation_id: correlationId,
      });
      return false;
    }
  }

  async delete(key: string, correlationId?: string): Promise<boolean> {
    const circuitBreaker = this.circuitBreakerService.createCircuit(
      'redis_delete',
      {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
      },
    );

    try {
      const result = await circuitBreaker.execute(async () => {
        const startTime = Date.now();
        const deletedCount = await this.client.del(key);

        const duration = Date.now() - startTime;
        this.logger.logPerformance(
          'cache_delete',
          duration,
          true,
          correlationId,
        );

        return deletedCount > 0;
      }, correlationId);

      this.logger.logCacheOperation('delete', key, correlationId);

      if (result) {
        this.stats.size = Math.max(0, this.stats.size - 1);
      }

      return result;
    } catch (error) {
      this.logger.error('cache_delete_failed', error as Error, {
        key,
        correlation_id: correlationId,
      });
      return false;
    }
  }

  async exists(key: string, correlationId?: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('cache_exists_failed', error as Error, {
        key,
        correlation_id: correlationId,
      });
      return false;
    }
  }

  async flush(correlationId?: string): Promise<boolean> {
    try {
      await this.client.flushDb();
      this.stats.size = 0;
      this.logger.logCacheOperation('delete', 'all', correlationId);
      return true;
    } catch (error) {
      this.logger.error('cache_flush_failed', error as Error, {
        correlation_id: correlationId,
      });
      return false;
    }
  }

  // Template-specific cache methods
  async getTemplate(
    code: string,
    correlationId?: string,
  ): Promise<Template | null> {
    const key = this.buildTemplateKey(code);
    return this.get<Template>(key, correlationId);
  }

  async setTemplate(
    code: string,
    template: Template,
    correlationId?: string,
  ): Promise<boolean> {
    const key = this.buildTemplateKey(code);
    return this.set(key, template, undefined, correlationId);
  }

  async invalidateTemplate(
    code: string,
    correlationId?: string,
  ): Promise<boolean> {
    const key = this.buildTemplateKey(code);
    return this.delete(key, correlationId);
  }

  async invalidateTemplatesByType(
    type: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      const pattern = `template:*:type:${type}`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.logCacheOperation('delete', pattern, correlationId, {
          keys_deleted: keys.length,
        });
      }
    } catch (error) {
      this.logger.error('cache_invalidate_by_type_failed', error as Error, {
        type,
        correlation_id: correlationId,
      });
    }
  }

  private buildTemplateKey(code: string): string {
    return `template:${code}`;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  getStats(): CacheStatistics {
    return { ...this.stats };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('redis_health_check_failed', error as Error);
      return false;
    }
  }
}
