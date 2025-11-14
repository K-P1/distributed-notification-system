#!/usr/bin/env node

/**
 * Email Service Railway Environment Variables Setup
 */

const essentialVariables = {
  // Application
  NODE_ENV: 'production',
  PORT: '8080',
  LOG_LEVEL: 'info',
  ENABLE_JSON_LOGGING: 'true',

  // RabbitMQ (CloudAMQP)
  RABBITMQ_URL:
    'amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv',

  // Queue Configuration
  EMAIL_QUEUE_NAME: 'email.queue',
  EXCHANGE_NAME: 'notifications.direct',
  DLX_NAME: 'notifications.dlx',
  FAILED_QUEUE_NAME: 'failed.queue',

  // Circuit Breaker
  CIRCUIT_BREAKER_THRESHOLD: '5',
  CIRCUIT_BREAKER_TIMEOUT: '60000',

  // Retry Logic
  MAX_RETRIES: '3',
  RETRY_DELAY_MS: '1000',
  EXPONENTIAL_BACKOFF: 'true',

  // Health & Metrics
  HEALTH_CHECK_INTERVAL: '30000',
  ENABLE_METRICS: 'true',
  METRICS_PORT: '9090',
};

const smtpVariables = {
  // SMTP Configuration (Gmail Example)
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'your-email@gmail.com', // ⚠️ UPDATE THIS
  SMTP_PASSWORD: 'your-app-password', // ⚠️ UPDATE THIS
  FROM_EMAIL: 'noreply@yourcompany.com', // ⚠️ UPDATE THIS
  FROM_NAME: 'Your Company', // ⚠️ UPDATE THIS
};

console.log('📧 EMAIL SERVICE - Railway Environment Variables\n');

console.log('🎯 STEP 1: Essential Variables (Add these first)\n');
Object.entries(essentialVariables).forEach(([key, value]) => {
  console.log(`${key} = ${value}`);
});

console.log(
  '\n📨 STEP 2: SMTP Configuration (Update with your email provider)\n',
);
Object.entries(smtpVariables).forEach(([key, value]) => {
  console.log(`${key} = ${value}`);
});

console.log('\n🚀 DEPLOYMENT STEPS:');
console.log('1. Go to Railway Dashboard');
console.log('2. Create New Project from GitHub');
console.log('3. Select your repo → services/email-service');
console.log('4. Add variables above in Variables tab');
console.log('5. Watch deployment in Logs tab');

console.log('\n✅ SUCCESS INDICATORS:');
console.log('- Build completes without errors');
console.log('- Health check passes at /health');
console.log('- Log shows: "email_service_started"');

console.log('\n⚠️ CONFIGURE SMTP:');
console.log('- Update SMTP variables with your email provider');
console.log('- Gmail: Use App Password, not regular password');
console.log('- SendGrid: Use API key as password');

console.log("\n🔗 After deployment, you'll get:");
console.log('- Railway URL: https://your-email-service.railway.app');
console.log('- Health endpoint: https://your-email-service.railway.app/health');
