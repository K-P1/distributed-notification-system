import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { LoggerService } from '../utils/logger.service';
import { NotificationMessage } from '../types';
import { CircuitBreakerService } from './circuit-breaker.service';
export declare class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private readonly circuitBreakerService;
    private connection;
    private channel;
    private isConnected;
    constructor(config: AppConfigService, logger: LoggerService, circuitBreakerService: CircuitBreakerService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private connect;
    private setupTopology;
    consume(queueName: string, handler: (message: NotificationMessage, correlationId: string) => Promise<void>): Promise<void>;
    disconnect(): Promise<void>;
    checkHealth(): Promise<boolean>;
    getQueueInfo(queueName: string): Promise<import("amqplib").Replies.AssertQueue | null>;
}
