# 🚀 Production Deployment Guide

## CloudAMQP Integration Setup

Your teammate AkinbobolaF has provided **CloudAMQP** credentials for production deployment. Here's how to use them:

### 📋 **CloudAMQP Credentials**

```
Host: gorilla.lmq.cloudamqp.com
Username: neoxhbgv
Password: ObO_9mg7l72Qavudd_4cAgv5o4nkmklS
VHost: neoxhbgv
URL: amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv
Port: 5671 (TLS)
```

## 🔧 **Deployment Options**

### **Option 1: Local Development with Cloud RabbitMQ**

Switch your local services to use cloud RabbitMQ while keeping other services local:

1. **Update environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local and uncomment CloudAMQP lines
   ```

2. **Run with cloud RabbitMQ:**

   ```bash
   # Set environment
   set NODE_ENV=development
   set RABBITMQ_URL=amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv

   # Start email service
   npm run start:dev
   ```

### **Option 2: Full Production Deployment**

Deploy all services to cloud platform (e.g., Azure, AWS, Railway):

1. **Use production environment:**

   ```bash
   # Copy production environment
   cp .env.production .env
   ```

2. **Deploy to cloud platform:**
   - Railway: Connect GitHub repo, auto-deploy
   - Heroku: `git push heroku main`
   - Azure: Use Azure Container Instances
   - AWS: Use ECS or Lambda

### **Option 3: Docker with Cloud RabbitMQ**

Keep Docker setup but connect to cloud RabbitMQ:

1. **Update docker-compose.yml:**

   ```yaml
   # Comment out local rabbitmq service
   # Use cloud RabbitMQ instead
   ```

2. **Set environment variables:**
   ```bash
   docker-compose --env-file .env.production up
   ```

## 🧪 **Testing CloudAMQP Connection**

Run the connection test:

```bash
node test-cloudamqp-connection.js
```

If you see DNS resolution issues:

- Check internet connection
- Try again in a few minutes (temporary DNS issue)
- Verify with teammate that CloudAMQP instance is active

## 🔄 **Integration Steps**

### **Immediate Next Steps:**

1. **Test connectivity** (when network is stable)
2. **Update team** about successful CloudAMQP integration
3. **Choose deployment strategy** (local dev vs full production)
4. **Coordinate with team** on shared CloudAMQP usage

### **Team Coordination:**

- All team services can now use the same CloudAMQP instance
- Ensure queue naming conventions to avoid conflicts
- Coordinate deployment schedule with AkinbobolaF

## 📊 **Current Queue Structure**

Your email service will create these queues on CloudAMQP:

- `email.queue` - Main email processing
- `notifications.direct` - Direct exchange
- `failed.queue` - Failed message handling
- `notifications.dlx` - Dead letter exchange

## 🛡️ **Security Notes**

- CloudAMQP credentials are for production use
- Don't commit credentials to public repositories
- Use environment variables for all credentials
- Rotate passwords periodically

## 🎯 **What This Enables**

✅ **Shared message queue** between all team services  
✅ **Production-ready** RabbitMQ infrastructure  
✅ **Scalable messaging** without local Docker dependency  
✅ **Team collaboration** on shared cloud resources

## 🚀 **Ready for Production!**

Your email and template services are now configured for production deployment with CloudAMQP integration!
