"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_service_1 = require("./config/config.service");
const logger_service_1 = require("./utils/logger.service");
const circuit_breaker_service_1 = require("./infrastructure/circuit-breaker.service");
const retry_service_1 = require("./infrastructure/retry.service");
const rabbitmq_service_1 = require("./infrastructure/rabbitmq.service");
const smtp_service_1 = require("./services/smtp.service");
const template_renderer_service_1 = require("./services/template-renderer.service");
const status_update_service_1 = require("./services/status-update.service");
const email_processor_service_1 = require("./services/email-processor.service");
const health_controller_1 = require("./controllers/health.controller");
const metrics_controller_1 = require("./controllers/metrics.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
        ],
        controllers: [app_controller_1.AppController, health_controller_1.HealthController, metrics_controller_1.MetricsController],
        providers: [
            app_service_1.AppService,
            config_service_1.AppConfigService,
            logger_service_1.LoggerService,
            circuit_breaker_service_1.CircuitBreakerService,
            retry_service_1.RetryService,
            rabbitmq_service_1.RabbitMQService,
            smtp_service_1.SMTPService,
            template_renderer_service_1.TemplateRenderer,
            status_update_service_1.StatusUpdateService,
            email_processor_service_1.EmailProcessor,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map