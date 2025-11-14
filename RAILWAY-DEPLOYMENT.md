# Railway Deployment Steps

## 🚂 **Deploy Email Service to Railway**

### **Quick Deployment (5 minutes):**

1. **Go to Railway**: https://railway.app
2. **Sign in** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select**: `K-P1/distributed-notification-system`
5. **Service Path**: `services/email-service`

### **Environment Variables to Set:**
```
NODE_ENV=production
PORT=3001
RABBITMQ_URL=amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv
EMAIL_QUEUE_NAME=email.queue.omoke
EXCHANGE_NAME=notifications.direct
DLX_NAME=notifications.dlx.omoke
FAILED_QUEUE_NAME=failed.queue.omoke
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourcompany.com
FROM_NAME=Notification Service
LOG_LEVEL=info
ENABLE_JSON_LOGGING=true
```

### **Alternative: Heroku Deployment**
```bash
# Install Heroku CLI first
heroku create omoke-email-service
heroku config:set RABBITMQ_URL="amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv"
heroku config:set EMAIL_QUEUE_NAME="email.queue.omoke"
git subtree push --prefix services/email-service heroku main
```

🎯 **Your service will be live in minutes!**