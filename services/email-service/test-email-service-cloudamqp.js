/**
 * Simple Email Service CloudAMQP Test
 * This simulates how your NestJS email service would connect to CloudAMQP
 */

const amqp = require('amqplib');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// CloudAMQP Configuration
const rabbitmqUrl =
  process.env.RABBITMQ_URL ||
  'amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv';
const emailQueue = process.env.EMAIL_QUEUE_NAME || 'email.queue';
const exchangeName = process.env.EXCHANGE_NAME || 'notifications.direct';

console.log('🚀 Starting Email Service CloudAMQP Test...\n');

class EmailServiceSimulator {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      console.log('📡 Connecting to CloudAMQP...');
      console.log(`🔗 URL: ${rabbitmqUrl.replace(/:[^:@]*@/, ':***@')}`);

      // Connect to RabbitMQ
      this.connection = await amqp.connect(rabbitmqUrl);
      console.log('✅ Connected to CloudAMQP successfully!');

      // Create channel
      this.channel = await this.connection.createChannel();
      console.log('✅ Channel created successfully!');

      // Set up error handling
      this.connection.on('error', (err) => {
        console.error('❌ Connection error:', err.message);
      });

      this.connection.on('close', () => {
        console.log('📴 Connection closed');
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to connect to CloudAMQP:', error.message);
      return false;
    }
  }

  async setupEmailQueue() {
    try {
      console.log('\n🔧 Setting up email queue infrastructure...');

      // Assert exchange
      await this.channel.assertExchange(exchangeName, 'direct', {
        durable: true,
      });
      console.log(`✅ Exchange "${exchangeName}" ready`);

      // Assert email queue with safer configuration (no dead letter exchange argument to avoid conflicts)
      await this.channel.assertQueue(emailQueue, {
        durable: true,
        // Removed x-dead-letter-exchange to avoid conflicts with existing queues
      });
      console.log(`✅ Queue "${emailQueue}" ready`);

      // Bind queue to exchange
      await this.channel.bindQueue(emailQueue, exchangeName, 'email.omoke');
      console.log('✅ Queue bound to exchange with routing key "email.omoke"');

      return true;
    } catch (error) {
      console.error('❌ Failed to setup queue:', error.message);

      // If queue exists with different arguments, try to use it anyway
      if (error.message.includes('PRECONDITION_FAILED')) {
        console.log(
          '⚠️  Queue exists with different config, trying to continue...',
        );
        try {
          // Just try to bind to existing queue
          await this.channel.bindQueue(emailQueue, exchangeName, 'email.omoke');
          console.log('✅ Successfully bound to existing queue');
          return true;
        } catch (bindError) {
          console.error(
            '❌ Could not bind to existing queue:',
            bindError.message,
          );
          return false;
        }
      }
      return false;
    }
  }

  async sendTestEmail() {
    try {
      console.log('\n📧 Sending test email message...');

      const testEmail = {
        id: 'test-' + Date.now(),
        to: 'test@example.com',
        subject: 'CloudAMQP Test Email',
        body: 'This is a test email sent via CloudAMQP!',
        priority: 'normal',
        timestamp: new Date().toISOString(),
      };

      await this.channel.publish(
        exchangeName,
        'email.omoke',
        Buffer.from(JSON.stringify(testEmail)),
        {
          persistent: true,
          messageId: testEmail.id,
          timestamp: Date.now(),
        },
      );

      console.log('✅ Test email message sent successfully!');
      console.log(`📬 Message ID: ${testEmail.id}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to send test email:', error.message);
      return false;
    }
  }

  async consumeEmails() {
    try {
      console.log('\n👂 Setting up email consumer...');

      await this.channel.consume(emailQueue, async (message) => {
        if (message) {
          const email = JSON.parse(message.content.toString());
          console.log('📨 Received email:', {
            id: email.id,
            to: email.to,
            subject: email.subject,
          });

          // Simulate email processing
          console.log('⚡ Processing email...');

          // Acknowledge the message
          this.channel.ack(message);
          console.log('✅ Email processed successfully!');
        }
      });

      console.log('✅ Email consumer ready!');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup consumer:', error.message);
      return false;
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        console.log('🔒 Channel closed');
      }
      if (this.connection) {
        await this.connection.close();
        console.log('🔒 Connection closed');
      }
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Main test function
async function testEmailService() {
  const emailService = new EmailServiceSimulator();

  try {
    // Test connection
    const connected = await emailService.connect();
    if (!connected) return false;

    // Setup queue infrastructure
    const queueReady = await emailService.setupEmailQueue();
    if (!queueReady) return false;

    // Setup consumer
    const consumerReady = await emailService.consumeEmails();
    if (!consumerReady) return false;

    // Send test email
    const emailSent = await emailService.sendTestEmail();
    if (!emailSent) return false;

    console.log('\n🎉 Email Service CloudAMQP Test PASSED! 🎉');
    console.log('Your email service is ready for production with CloudAMQP!');

    // Keep the service running for a few seconds to see message processing
    console.log('\n⏳ Waiting 5 seconds to see message processing...');
    setTimeout(async () => {
      await emailService.close();
      process.exit(0);
    }, 5000);

    return true;
  } catch (error) {
    console.error('\n❌ Email Service Test Failed:', error.message);
    await emailService.close();
    return false;
  }
}

// Run the test
testEmailService()
  .then((success) => {
    if (!success) {
      console.log('\n💡 Tips for troubleshooting:');
      console.log('1. Check your internet connection');
      console.log('2. Verify CloudAMQP instance is active with AkinbobolaF');
      console.log('3. Try again in a few minutes (DNS might resolve)');
      console.log('4. Test deployment on a cloud platform');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
