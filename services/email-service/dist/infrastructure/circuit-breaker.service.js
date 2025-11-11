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
exports.CircuitBreaker = exports.CircuitBreakerService = exports.CircuitState = void 0;
exports.WithCircuitBreaker = WithCircuitBreaker;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../utils/logger.service");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
let CircuitBreakerService = class CircuitBreakerService {
    logger;
    circuits = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    createCircuit(name, config) {
        if (this.circuits.has(name)) {
            return this.circuits.get(name);
        }
        const circuit = new CircuitBreaker(name, config, this.logger);
        this.circuits.set(name, circuit);
        return circuit;
    }
    getCircuit(name) {
        return this.circuits.get(name);
    }
    getCircuitStats(name) {
        const circuit = this.circuits.get(name);
        return circuit ? circuit.getStats() : null;
    }
    getAllCircuitStats() {
        const stats = {};
        this.circuits.forEach((circuit, name) => {
            stats[name] = circuit.getStats();
        });
        return stats;
    }
    onModuleDestroy() {
        this.circuits.forEach((circuit) => circuit.destroy());
        this.circuits.clear();
    }
};
exports.CircuitBreakerService = CircuitBreakerService;
exports.CircuitBreakerService = CircuitBreakerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], CircuitBreakerService);
class CircuitBreaker {
    name;
    config;
    logger;
    state = CircuitState.CLOSED;
    failures = 0;
    lastFailureTime = 0;
    successCount = 0;
    totalRequests = 0;
    lastRequestTime = 0;
    constructor(name, config, logger) {
        this.name = name;
        this.config = config;
        this.logger = logger;
    }
    async execute(operation, correlationId) {
        this.totalRequests++;
        this.lastRequestTime = Date.now();
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
                this.logger.logWithCorrelation('info', 'circuit_breaker_half_open', correlationId, { circuit: this.name });
            }
            else {
                const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
                this.logger.logWithCorrelation('warn', 'circuit_breaker_rejected', correlationId, { circuit: this.name, state: this.state });
                throw error;
            }
        }
        try {
            const result = await operation();
            this.onSuccess(correlationId);
            return result;
        }
        catch (error) {
            this.onFailure(error, correlationId);
            throw error;
        }
    }
    onSuccess(correlationId) {
        this.failures = 0;
        this.successCount++;
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            this.logger.logWithCorrelation('info', 'circuit_breaker_closed', correlationId, { circuit: this.name });
        }
    }
    onFailure(error, correlationId) {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.shouldOpenCircuit(error)) {
            this.state = CircuitState.OPEN;
            this.logger.logWithCorrelation('error', 'circuit_breaker_opened', correlationId, {
                circuit: this.name,
                failures: this.failures,
                threshold: this.config.failureThreshold,
                error: error.message,
            });
        }
        else {
            this.logger.logWithCorrelation('warn', 'circuit_breaker_failure', correlationId, {
                circuit: this.name,
                failures: this.failures,
                threshold: this.config.failureThreshold,
                error: error.message,
            });
        }
    }
    shouldOpenCircuit(error) {
        if (this.state === CircuitState.OPEN) {
            return false;
        }
        if (this.config.expectedErrors) {
            const isExpectedError = this.config.expectedErrors.some((ExpectedError) => error instanceof ExpectedError);
            if (!isExpectedError) {
                return false;
            }
        }
        return this.failures >= this.config.failureThreshold;
    }
    shouldAttemptReset() {
        return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
    }
    getStats() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successCount: this.successCount,
            totalRequests: this.totalRequests,
            successRate: this.totalRequests > 0 ? this.successCount / this.totalRequests : 0,
            lastFailureTime: this.lastFailureTime,
            lastRequestTime: this.lastRequestTime,
            config: this.config,
        };
    }
    destroy() {
    }
}
exports.CircuitBreaker = CircuitBreaker;
function WithCircuitBreaker(circuitName, config) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const circuitBreaker = this.circuitBreakerService;
            if (!circuitBreaker) {
                throw new Error('CircuitBreakerService not injected');
            }
            const circuit = circuitBreaker.createCircuit(circuitName, {
                failureThreshold: 5,
                recoveryTimeout: 60000,
                monitoringPeriod: 10000,
                ...config,
            });
            return circuit.execute(() => method.apply(this, args));
        };
    };
}
//# sourceMappingURL=circuit-breaker.service.js.map