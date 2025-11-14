# Railway Environment Variables Setup

## 🚨 **Critical Missing Variables**

Your Template Service needs these additional environment variables in Railway:

### **1. Essential Variables (Add These First):**

```bash
# Application
VERSION=1.0.0
NODE_ENV=production

# Circuit Breaker (Required for health checks)
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Retry Logic
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Logging
ENABLE_JSON_LOGGING=true
LOG_LEVEL=info

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
```

### **2. How to Add Variables in Railway:**

1. Go to your Railway dashboard
2. Click on **Template Service**
3. Go to **Variables** tab
4. Click **+ Variable**
5. Add each variable name and value
6. Railway will automatically redeploy

### **3. Current Variables You Have:**

✅ PORT  
✅ DATABASE_URL  
✅ REDIS_URL  
✅ RABBITMQ_URL  
✅ JWT_SECRET  
✅ TEMPLATE_BUCKET_NAME  
✅ EMAIL_SERVICE_URL  
✅ PUSH_SERVICE_URL  
✅ API_RATE_LIMIT_MAX  
✅ API_RATE_LIMIT_WINDOW_MS  
✅ CORS_ORIGIN  
✅ FILE_SIZE_LIMIT_MB  
✅ TEMPLATE_CACHE_TTL  
✅ MAX_TEMPLATES_PER_USER  
✅ ALLOWED_FILE_TYPES  
✅ TEMPLATE_VALIDATION_TIMEOUT  
✅ BACKGROUND_JOB_CONCURRENCY  

### **4. Priority Order:**

**Add these 3 variables FIRST:**
1. `VERSION=1.0.0`
2. `CIRCUIT_BREAKER_THRESHOLD=5` 
3. `CIRCUIT_BREAKER_TIMEOUT=60000`

These are likely causing your health check failures.

### **5. Watch Deployment:**

After adding variables:
1. Railway will auto-redeploy
2. Watch the **Logs** tab for startup messages
3. Look for "✅ Template Service started successfully!"
4. Health check should pass at `/api/v1/health`

---

## 🔍 **Troubleshooting Steps:**

If health checks still fail after adding variables:

1. **Check Logs**: Railway Dashboard → Template Service → Logs
2. **Check Build**: Look for build errors or warnings  
3. **Test Locally**: Run with same environment variables
4. **Contact Support**: Railway has excellent support if needed

---

## 🎯 **Expected Success Output:**

```
🚀 Template Service starting...
📊 Environment: production
🔌 Port: 8000
🏗️ Creating NestJS application...
⚙️ Getting configuration services...
📝 Setting up logger...
✅ Setting up validation pipes...
🌐 Enabling CORS...
🛣️ Setting global prefix...
🚀 Starting server on port 8000...
✅ Template Service started successfully!
🌍 Health check: http://localhost:8000/api/v1/health
```