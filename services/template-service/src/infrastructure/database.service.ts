import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private isConnected = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.pool = new Pool({
      host: this.config.databaseHost,
      port: this.config.databasePort,
      user: this.config.databaseUser,
      password: this.config.databasePassword,
      database: this.config.databaseName,
      max: 10, // Reduced for Railway
      min: 2, // Maintain minimum connections
      idleTimeoutMillis: 60000, // 1 minute
      connectionTimeoutMillis: 60000, // 1 minute for Railway latency
      statement_timeout: 60000, // 1 minute query timeout
      query_timeout: 60000, // 1 minute query timeout
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    this.pool.on('error', (error) => {
      this.logger.error('database_pool_error', error);
      this.isConnected = false;
    });

    this.pool.on('connect', () => {
      this.isConnected = true;
      this.logger.info('database_connection_established');
    });
  }

  async onModuleInit() {
    // Start database initialization in background - don't block app startup
    this.initializeDatabaseAsync();
  }

  private async initializeDatabaseAsync(): Promise<void> {
    // Wait a bit before connecting to let Railway services fully initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let retries = 3;
    let lastError: Error | undefined;

    while (retries > 0) {
      try {
        await this.testConnection();
        await this.createTables();
        this.logger.info('database_initialization_completed');
        return;
      } catch (error) {
        lastError = error as Error;
        retries--;
        this.logger.warn('database_initialization_failed', {
          retries_left: retries,
          error: lastError.message,
        });

        if (retries > 0) {
          // Wait before retry with exponential backoff
          const waitTime = (4 - retries) * 5000; // 5s, 10s, 15s
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    this.logger.error('database_initialization_failed_final', lastError!);
    // Don't throw error - let app continue to start for health checks
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async getClient(): Promise<PoolClient> {
    const circuitBreaker = this.circuitBreakerService.createCircuit(
      'database_connection',
      {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
      },
    );

    return circuitBreaker.execute(async () => {
      return this.pool.connect();
    });
  }

  async query<T = any>(
    text: string,
    params?: any[],
    correlationId?: string,
  ): Promise<T[]> {
    const startTime = Date.now();
    let client: PoolClient | undefined;

    try {
      client = await this.getClient();
      const result = await client.query(text, params);

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'query',
        'unknown',
        duration,
        true,
        correlationId,
        {
          query: text.substring(0, 100),
          param_count: params?.length || 0,
          result_count: result.rowCount || 0,
        },
      );

      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'query',
        'unknown',
        duration,
        false,
        correlationId,
        {
          query: text.substring(0, 100),
          param_count: params?.length || 0,
          error: (error as Error).message,
        },
      );
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    correlationId?: string,
  ): Promise<T> {
    const startTime = Date.now();
    let client: PoolClient | undefined;

    try {
      client = await this.getClient();
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'transaction',
        'unknown',
        duration,
        true,
        correlationId,
      );

      return result;
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }

      const duration = Date.now() - startTime;
      this.logger.logDatabaseOperation(
        'transaction',
        'unknown',
        duration,
        false,
        correlationId,
        {
          error: (error as Error).message,
        },
      );
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = (await Promise.race([
        this.pool.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000),
        ),
      ])) as PoolClient;

      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.warn('database_health_check_failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  async testConnection(): Promise<void> {
    this.logger.info('database_testing_connection');

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT NOW() as server_time, version() as version',
      );
      this.logger.info('database_connection_test_passed', {
        server_time: result.rows[0].server_time,
        version: result.rows[0].version.substring(0, 50),
      });
    } finally {
      client.release();
    }
  }

  private async createTables(): Promise<void> {
    try {
      this.logger.info('database_creating_tables');

      // Templates table
      await this.query(`
        CREATE TABLE IF NOT EXISTS templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(500) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'push')),
          subject VARCHAR(500),
          content TEXT NOT NULL,
          variables TEXT[] DEFAULT '{}',
          language VARCHAR(10) NOT NULL DEFAULT 'en',
          version INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          tags TEXT[] DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255) NOT NULL,
          updated_by VARCHAR(255) NOT NULL
        )
      `);

      // Template versions table
      await this.query(`
        CREATE TABLE IF NOT EXISTS template_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          subject VARCHAR(500),
          content TEXT NOT NULL,
          variables TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255) NOT NULL,
          change_log TEXT,
          metadata JSONB DEFAULT '{}',
          UNIQUE(template_id, version)
        )
      `);

      // Indexes for performance
      await this.query(`
        CREATE INDEX IF NOT EXISTS idx_templates_code ON templates(code);
        CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
        CREATE INDEX IF NOT EXISTS idx_templates_language ON templates(language);
        CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
        CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at);
        CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
        CREATE INDEX IF NOT EXISTS idx_template_versions_version ON template_versions(version);
        CREATE INDEX IF NOT EXISTS idx_template_versions_active ON template_versions(is_active);
      `);

      // Trigger to update updated_at timestamp
      await this.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language plpgsql;

        DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
        CREATE TRIGGER update_templates_updated_at
          BEFORE UPDATE ON templates
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      this.logger.info('database_tables_created');
    } catch (error) {
      this.logger.error('database_table_creation_failed', error as Error);
      throw error;
    }
  }

  getConnectionInfo() {
    return {
      host: this.config.databaseHost,
      port: this.config.databasePort,
      database: this.config.databaseName,
      connected: this.isConnected,
      pool_size: this.pool.totalCount,
      idle_connections: this.pool.idleCount,
      waiting_count: this.pool.waitingCount,
    };
  }
}
