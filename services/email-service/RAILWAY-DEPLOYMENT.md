# 📧 Email Service Railway Deployment Guide

## 🚀 **Ready to Deploy!**

The Email Service is much simpler than the Template Service and should deploy successfully. Here's what you need:

---

## **📋 Required Environment Variables for Railway:**

### **1. Essential Variables:**

```bash
# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
ENABLE_JSON_LOGGING=true

# RabbitMQ (Use CloudAMQP)
RABBITMQ_URL=amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv

# Queue Configuration
EMAIL_QUEUE_NAME=email.queue
EXCHANGE_NAME=notifications.direct
DLX_NAME=notifications.dlx
FAILED_QUEUE_NAME=failed.queue

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Retry Logic
MAX_RETRIES=3
RETRY_DELAY_MS=1000
EXPONENTIAL_BACKOFF=true

# Health & Metrics
HEALTH_CHECK_INTERVAL=30000
ENABLE_METRICS=true
METRICS_PORT=9090
```

### **2. SMTP Configuration (Add Your Email Provider):**

**For Gmail:**

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourcompany.com
FROM_NAME=Your Company
```

**For SendGrid:**

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
FROM_EMAIL=noreply@yourcompany.com
FROM_NAME=Your Company
```

### **3. Service URLs (Add After Other Services Deploy):**

```bash
API_GATEWAY_URL=https://your-api-gateway.railway.app
API_GATEWAY_TIMEOUT=10000
TEMPLATE_SERVICE_URL=https://your-template-service.railway.app
TEMPLATE_SERVICE_TIMEOUT=5000

# Redis (Optional - can add Railway Redis later)
REDIS_URL=redis://localhost:6379
```

---

## **🎯 Quick Deployment Steps:**

### **Step 1: Create Railway Project**

1. Go to **Railway Dashboard**
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `distributed-notification-system` repo
5. Choose `services/email-service` as root directory

### **Step 2: Add Environment Variables**

1. Click **Variables** tab
2. Add the variables above (start with the essential ones)
3. **Don't add service URLs yet** - deploy this first

### **Step 3: Monitor Deployment**

1. Watch **Logs** tab for:
   ```
   email_service_started: {"port": 8080, "environment": "production", "version": "1.0.0"}
   ```
2. Health check should pass at `/health`

### **Step 4: Test Health Endpoint**

- Visit: `https://your-email-service.railway.app/health`
- Should return service status and dependencies

---

## **✅ What's Already Fixed:**

- ✅ **railway.json**: Fixed JSON format and health check path
- ✅ **package.json**: Removed cross-env dependency for Railway
- ✅ **nixpacks.toml**: Added Railway-specific build configuration
- ✅ **Health endpoint**: Available at `/health`
- ✅ **Port handling**: Configured for Railway's dynamic ports

---

## **🔍 Expected Success Output:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T12:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "dependencies": {
    "rabbitmq": "healthy",
    "smtp": "degraded", // Until SMTP configured
    "redis": "healthy",
    "template_service": "healthy",
    "api_gateway": "degraded" // Until other services deployed
  },
  "metrics": {
    "messages_processed": 0,
    "queue_size": 0,
    "failed_messages": 0
  }
}
```

---

## **⚠️ Important Notes:**

1. **SMTP Configuration**: You'll need to configure your email provider (Gmail, SendGrid, etc.)
2. **CloudAMQP**: The RabbitMQ URL is already set for your existing CloudAMQP instance
3. **Service Dependencies**: Some health checks will show "degraded" until other services are deployed
4. **Redis**: Optional for now - you can add Redis service later if needed

---

## **📞 Next Steps:**

1. **Deploy Email Service** to Railway first
2. **Configure SMTP** with your email provider
3. **Test health endpoint**
4. **Deploy other services** and update service URLs

This should be a much smoother deployment than the Template Service! 🚀
