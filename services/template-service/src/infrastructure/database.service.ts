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
    // Use DATABASE_URL directly for Railway compatibility
    const databaseUrl = this.config.databaseUrl;
    
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10, // Reduced pool size for Railway
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased from 10s to 30s
      query_timeout: 60000, // 60 second query timeout
      statement_timeout: 60000, // 60 second statement timeout
      ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (error) => {
      this.logger.error('database_pool_error', error);
      this.isConnected = false;
    });

    this.pool.on('connect', (client) => {
      this.isConnected = true;
      this.logger.info('database_connection_established');
      
      // Set connection-level timeouts
      client.query('SET statement_timeout = 60000'); // 60s
      client.query('SET lock_timeout = 30000'); // 30s
    });
  }

  async onModuleInit() {
    try {
      this.logger.info('database_initializing');
      
      // Test connection first
      await this.testConnection();
      
      // Create tables with retry logic
      await this.createTablesWithRetry();
      
      this.logger.info('database_initialization_complete');
    } catch (error) {
      this.logger.error('database_initialization_failed', error as Error);
      // Don't throw - let the app start and mark as unhealthy
      this.isConnected = false;
    }
  }

  private async testConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
      this.logger.info('database_connection_test_successful');
    } finally {
      client.release();
    }
  }

  private async createTablesWithRetry(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 5000; // 5 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.createTables();
        return; // Success!
      } catch (error) {
        this.logger.error(`database_table_creation_attempt_${attempt}_failed`, error as Error);
        
        if (attempt < maxRetries) {
          this.logger.info(`database_retrying_in_${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw error; // Final attempt failed
        }
      }
    }
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

  private async createTables(): Promise<void> {
    try {
      this.logger.info('database_creating_tables');

      // Create templates table first
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

      // Create template versions table
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

      // Create indexes separately
      await this.createIndexes();

      // Create trigger function and triggers
      await this.createTriggers();

      this.logger.info('database_tables_created');
    } catch (error) {
      this.logger.error('database_table_creation_failed', error as Error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_templates_code ON templates(code)',
      'CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type)',
      'CREATE INDEX IF NOT EXISTS idx_templates_language ON templates(language)',
      'CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags)',
      'CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id)',
      'CREATE INDEX IF NOT EXISTS idx_template_versions_version ON template_versions(version)',
      'CREATE INDEX IF NOT EXISTS idx_template_versions_active ON template_versions(is_active)',
    ];

    for (const indexSql of indexes) {
      try {
        await this.query(indexSql);
      } catch (error) {
        this.logger.error('database_index_creation_failed', error as Error, { sql: indexSql });
        // Continue with other indexes
      }
    }
  }

  private async createTriggers(): Promise<void> {
    try {
      // Create trigger function
      await this.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language plpgsql
      `);

      // Create trigger
      await this.query(`
        DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
        CREATE TRIGGER update_templates_updated_at
          BEFORE UPDATE ON templates
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
      `);
    } catch (error) {
      this.logger.error('database_trigger_creation_failed', error as Error);
      // Don't throw - triggers are nice to have but not essential
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('database_health_check_failed', error as Error);
      return false;
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
