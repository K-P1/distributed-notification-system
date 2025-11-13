# 📧 Email Service

A robust, scalable email service built with NestJS for the distributed notification system. This service handles email delivery through message queues, integrates with the Template Service for dynamic content rendering, and provides comprehensive monitoring and error handling.

## 🎯 Overview

The Email Service is a critical component of the distributed notification system that:

- **Consumes messages** from RabbitMQ queues
- **Renders email content** by integrating with the Template Service
- **Sends emails** via SMTP with retry mechanisms and circuit breakers
- **Provides monitoring** through health checks and metrics
- **Handles failures** with dead letter queues and comprehensive logging

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│   RabbitMQ      │───▶│  Email Service  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Template Service│◀───│     Redis       │    │   SMTP Server   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Features

### **Core Functionality**

- ✅ **Message Queue Integration** - Consumes from RabbitMQ with automatic acknowledgments
- ✅ **Template Rendering** - Integrates with Template Service for dynamic content
- ✅ **SMTP Email Delivery** - Reliable email sending with configurable providers
- ✅ **Variable Interpolation** - Advanced {{variable}} syntax support
- ✅ **HTML & Text Generation** - Automatic plain text conversion from HTML

### **Reliability & Monitoring**

- ✅ **Circuit Breaker Pattern** - Prevents cascade failures
- ✅ **Retry Mechanisms** - Exponential backoff for failed deliveries
- ✅ **Dead Letter Queues** - Handles permanent failures
- ✅ **Health Checks** - Comprehensive dependency monitoring
- ✅ **Metrics & Logging** - Detailed performance tracking
- ✅ **Correlation IDs** - Request tracing across services

### **Production Ready**

- ✅ **Docker Support** - Multi-stage builds with health checks
- ✅ **Environment Configuration** - Flexible config management
- ✅ **Rate Limiting** - Prevents SMTP provider abuse
- ✅ **Security** - Input validation and sanitization

## 📋 Prerequisites

- **Node.js** 18+
- **Docker & Docker Compose**
- **RabbitMQ** (message queuing)
- **Redis** (caching)
- **Template Service** (content rendering)
- **SMTP Server** (email delivery)

## 🛠️ Installation

### **1. Clone and Install**

```bash
git clone <repository-url>
cd services/email-service
npm install
```

### **2. Environment Configuration**

```bash
cp .env.example .env
# Edit .env with your configuration
```

### **3. Start Dependencies**

```bash
# From project root
docker-compose up -d postgres redis rabbitmq
```

## ⚙️ Configuration

### **Environment Variables**

| Variable               | Default                             | Description                   |
| ---------------------- | ----------------------------------- | ----------------------------- |
| `PORT`                 | `3001`                              | Service port                  |
| `NODE_ENV`             | `development`                       | Environment                   |
| `RABBITMQ_URL`         | `amqp://guest:guest@localhost:5672` | Message queue URL             |
| `EMAIL_QUEUE_NAME`     | `email.queue`                       | Queue name for email messages |
| `REDIS_URL`            | `redis://localhost:6379`            | Cache URL                     |
| `TEMPLATE_SERVICE_URL` | `http://localhost:3002`             | Template service endpoint     |
| `SMTP_HOST`            | `localhost`                         | SMTP server host              |
| `SMTP_PORT`            | `587`                               | SMTP server port              |
| `FROM_EMAIL`           | `noreply@example.com`               | Default sender email          |
| `MAX_RETRIES`          | `3`                                 | Maximum retry attempts        |

## 🏃‍♂️ Running the Service

### **Development Mode**

```bash
npm run start:dev
```

### **Production Mode**

```bash
npm run build
npm run start:prod
```

### **Docker**

```bash
docker build -t email-service .
docker run -p 3001:3001 email-service
```

## 📡 API Endpoints

### **Health Check**

```http
GET /api/v1/health
```

### **Metrics**

```http
GET /api/v1/metrics
```

## 🧪 Testing

### **Unit Tests**

```bash
npm run test
```

### **E2E Tests**

```bash
npm run test:e2e
```

### **Integration Testing**

```bash
# Test RabbitMQ connectivity (from project root)
node test-email-service.js
```

## 📚 Related Documentation

- [Template Service API](../template-service/README.md)
- [TEMPLATE_ENDPOINTS_GUIDE.md](../../TEMPLATE_ENDPOINTS_GUIDE.md)
- [SERVICES_ANALYSIS_WORKFLOW.md](../../SERVICES_ANALYSIS_WORKFLOW.md)

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using NestJS, RabbitMQ, and modern Node.js practices.
