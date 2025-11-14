import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect } from 'amqplib';
import type { Connection, Channel, ConsumeMessage } from 'amqplib';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { NotificationMessage } from '../types';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: LoggerService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    // Don't block startup if RabbitMQ connection fails
    try {
      await this.connect();
    } catch (error) {
      this.logger.error('rabbitmq_init_failed_non_blocking', error as Error);
      // Continue startup even if RabbitMQ fails
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.logger.info('rabbitmq_connecting', { url: this.config.rabbitmqUrl });

      this.connection = (await connect(this.config.rabbitmqUrl)) as any;
      if (!this.connection) {
        throw new Error('Failed to establish connection');
      }

      this.channel = await (this.connection as any).createChannel();
      if (!this.channel) {
        throw new Error('Failed to create channel');
      }

      // Set up error handlers
      this.connection.on('error', (error: Error) => {
        this.logger.error('rabbitmq_connection_error', error);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('rabbitmq_connection_closed');
        this.isConnected = false;
      });

      this.channel.on('error', (error: Error) => {
        this.logger.error('rabbitmq_channel_error', error);
      });

      // Set prefetch on channel
      await this.channel.prefetch(10);

      this.isConnected = true;
      this.logger.info('rabbitmq_connected');

      // Set up queues and exchanges
      await this.setupTopology();
    } catch (error) {
      this.logger.error('rabbitmq_connect_failed', error as Error);
      this.isConnected = false;
      throw error;
    }
  }

  private async setupTopology(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    try {
      // Declare main exchange
      await this.channel.assertExchange(this.config.exchangeName, 'direct', {
        durable: true,
      });

      // Declare dead letter exchange
      await this.channel.assertExchange(
        this.config.deadLetterExchange,
        'direct',
        { durable: true },
      );

      // Declare failed queue (DLQ)
      await this.channel.assertQueue(this.config.failedQueueName, {
        durable: true,
      });

      // Bind failed queue to DLX
      await this.channel.bindQueue(
        this.config.failedQueueName,
        this.config.deadLetterExchange,
        'email.failed',
      );

      // Declare email queue with DLX configuration
      await this.channel.assertQueue(this.config.emailQueueName, {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // 1 hour TTL
          'x-max-length': 10000,
          'x-dead-letter-exchange': this.config.deadLetterExchange,
          'x-dead-letter-routing-key': 'email.failed',
        },
      });

      this.logger.info('rabbitmq_topology_setup_complete');
    } catch (error) {
      this.logger.error('rabbitmq_topology_setup_failed', error as Error);
      throw error;
    }
  }

  async consume(
    queueName: string,
    handler: (
      message: NotificationMessage,
      correlationId: string,
    ) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn('rabbitmq_channel_not_initialized', { queueName });
      throw new Error('Channel not initialized');
    }

    if (!this.isConnected) {
      this.logger.warn('rabbitmq_not_connected', { queueName });
      throw new Error('RabbitMQ not connected');
    }

    const circuitBreaker = this.circuitBreakerService.createCircuit(
      'rabbitmq_consume',
      {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 10000,
      },
    );

    await this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        const correlationId = msg.properties.correlationId || 'unknown';
        const messageId = msg.properties.messageId || 'unknown';

        try {
          await circuitBreaker.execute(async () => {
            const startTime = Date.now();

            this.logger.logWithCorrelation(
              'info',
              'message_received',
              correlationId,
              {
                queue: queueName,
                message_id: messageId,
                delivery_tag: msg.fields.deliveryTag,
              },
            );

            // Parse message
            const messageContent = JSON.parse(msg.content.toString());
            await handler(messageContent, correlationId);

            // Acknowledge message
            this.channel!.ack(msg);

            const processingTime = Date.now() - startTime;
            this.logger.logPerformance(
              'message_processed',
              processingTime,
              true,
              correlationId,
            );

            this.logger.logWithCorrelation(
              'info',
              'message_acknowledged',
              correlationId,
              {
                queue: queueName,
                message_id: messageId,
                processing_time_ms: processingTime,
              },
            );
          }, correlationId);
        } catch (error) {
          this.logger.error('message_processing_failed', error as Error, {
            queue: queueName,
            message_id: messageId,
            correlation_id: correlationId,
          });

          // Reject message and don't requeue (send to DLQ)
          this.channel!.nack(msg, false, false);

          this.logger.logWithCorrelation(
            'warn',
            'message_rejected',
            correlationId,
            {
              queue: queueName,
              message_id: messageId,
              error: (error as Error).message,
            },
          );
        }
      },
    );

    this.logger.info('rabbitmq_consumer_started', { queue: queueName });
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }

      this.isConnected = false;
      this.logger.info('rabbitmq_disconnected');
    } catch (error) {
      this.logger.error('rabbitmq_disconnect_failed', error as Error);
    }
  }

  async checkHealth(): Promise<boolean> {
    return (
      this.isConnected && this.connection !== null && this.channel !== null
    );
  }

  async getQueueInfo(queueName: string) {
    if (!this.channel) {
      return null;
    }

    try {
      return await this.channel.checkQueue(queueName);
    } catch (error) {
      this.logger.error('queue_info_failed', error as Error, {
        queue: queueName,
      });
      return null;
    }
  }
}
