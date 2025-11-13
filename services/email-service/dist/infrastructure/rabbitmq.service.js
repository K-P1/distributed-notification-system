"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQService = void 0;
const common_1 = require("@nestjs/common");
const amqplib_1 = require("amqplib");
const config_service_1 = require("../config/config.service");
const logger_service_1 = require("../utils/logger.service");
const circuit_breaker_service_1 = require("./circuit-breaker.service");
let RabbitMQService = class RabbitMQService {
    config;
    logger;
    circuitBreakerService;
    connection = null;
    channel = null;
    isConnected = false;
    constructor(config, logger, circuitBreakerService) {
        this.config = config;
        this.logger = logger;
        this.circuitBreakerService = circuitBreakerService;
    }
    async onModuleInit() {
        await this.connect();
    }
    async onModuleDestroy() {
        await this.disconnect();
    }
    async connect() {
        try {
            this.logger.info('rabbitmq_connecting', { url: this.config.rabbitmqUrl });
            this.connection = (await (0, amqplib_1.connect)(this.config.rabbitmqUrl));
            if (!this.connection) {
                throw new Error('Failed to establish connection');
            }
            this.channel = await this.connection.createChannel();
            if (!this.channel) {
                throw new Error('Failed to create channel');
            }
            this.connection.on('error', (error) => {
                this.logger.error('rabbitmq_connection_error', error);
                this.isConnected = false;
            });
            this.connection.on('close', () => {
                this.logger.warn('rabbitmq_connection_closed');
                this.isConnected = false;
            });
            this.channel.on('error', (error) => {
                this.logger.error('rabbitmq_channel_error', error);
            });
            await this.channel.prefetch(10);
            this.isConnected = true;
            this.logger.info('rabbitmq_connected');
            await this.setupTopology();
        }
        catch (error) {
            this.logger.error('rabbitmq_connect_failed', error);
            this.isConnected = false;
            throw error;
        }
    }
    async setupTopology() {
        if (!this.channel) {
            throw new Error('Channel not initialized');
        }
        try {
            await this.channel.assertExchange(this.config.exchangeName, 'direct', {
                durable: true,
            });
            await this.channel.assertExchange(this.config.deadLetterExchange, 'direct', { durable: true });
            await this.channel.assertQueue(this.config.failedQueueName, {
                durable: true,
            });
            await this.channel.bindQueue(this.config.failedQueueName, this.config.deadLetterExchange, 'email.failed');
            await this.channel.assertQueue(this.config.emailQueueName, {
                durable: true,
                arguments: {
                    'x-message-ttl': 3600000,
                    'x-max-length': 10000,
                    'x-dead-letter-exchange': this.config.deadLetterExchange,
                    'x-dead-letter-routing-key': 'email.failed',
                },
            });
            this.logger.info('rabbitmq_topology_setup_complete');
        }
        catch (error) {
            this.logger.error('rabbitmq_topology_setup_failed', error);
            throw error;
        }
    }
    async consume(queueName, handler) {
        if (!this.channel) {
            throw new Error('Channel not initialized');
        }
        const circuitBreaker = this.circuitBreakerService.createCircuit('rabbitmq_consume', {
            failureThreshold: 5,
            recoveryTimeout: 30000,
            monitoringPeriod: 10000,
        });
        await this.channel.consume(queueName, async (msg) => {
            if (!msg) {
                return;
            }
            const correlationId = msg.properties.correlationId || 'unknown';
            const messageId = msg.properties.messageId || 'unknown';
            try {
                await circuitBreaker.execute(async () => {
                    const startTime = Date.now();
                    this.logger.logWithCorrelation('info', 'message_received', correlationId, {
                        queue: queueName,
                        message_id: messageId,
                        delivery_tag: msg.fields.deliveryTag,
                    });
                    const messageContent = JSON.parse(msg.content.toString());
                    await handler(messageContent, correlationId);
                    this.channel.ack(msg);
                    const processingTime = Date.now() - startTime;
                    this.logger.logPerformance('message_processed', processingTime, true, correlationId);
                    this.logger.logWithCorrelation('info', 'message_acknowledged', correlationId, {
                        queue: queueName,
                        message_id: messageId,
                        processing_time_ms: processingTime,
                    });
                }, correlationId);
            }
            catch (error) {
                this.logger.error('message_processing_failed', error, {
                    queue: queueName,
                    message_id: messageId,
                    correlation_id: correlationId,
                });
                this.channel.nack(msg, false, false);
                this.logger.logWithCorrelation('warn', 'message_rejected', correlationId, {
                    queue: queueName,
                    message_id: messageId,
                    error: error.message,
                });
            }
        });
        this.logger.info('rabbitmq_consumer_started', { queue: queueName });
    }
    async disconnect() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            this.isConnected = false;
            this.logger.info('rabbitmq_disconnected');
        }
        catch (error) {
            this.logger.error('rabbitmq_disconnect_failed', error);
        }
    }
    async checkHealth() {
        return (this.isConnected && this.connection !== null && this.channel !== null);
    }
    async getQueueInfo(queueName) {
        if (!this.channel) {
            return null;
        }
        try {
            return await this.channel.checkQueue(queueName);
        }
        catch (error) {
            this.logger.error('queue_info_failed', error, {
                queue: queueName,
            });
            return null;
        }
    }
};
exports.RabbitMQService = RabbitMQService;
exports.RabbitMQService = RabbitMQService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.AppConfigService,
        logger_service_1.LoggerService,
        circuit_breaker_service_1.CircuitBreakerService])
], RabbitMQService);
//# sourceMappingURL=rabbitmq.service.js.map