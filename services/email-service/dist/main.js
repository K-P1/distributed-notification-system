"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const config_service_1 = require("./config/config.service");
const logger_service_1 = require("./utils/logger.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: false,
    });
    const configService = app.get(config_service_1.AppConfigService);
    const logger = app.get(logger_service_1.LoggerService);
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    app.enableCors({
        origin: true,
        credentials: true,
    });
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        await app.close();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        await app.close();
        process.exit(0);
    });
    const port = configService.port;
    await app.listen(port);
    logger.info('email_service_started', {
        port,
        environment: configService.environment,
        version: '1.0.0',
    });
}
bootstrap().catch((error) => {
    console.error('Failed to start email service:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map