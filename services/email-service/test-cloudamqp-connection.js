/**
 * CloudAMQP Connection Test Script
 * Tests connection to the production RabbitMQ instance
 */

const amqp = require('amqplib');

// CloudAMQP Credentials
const cloudAmqpConfig = {
  url: 'amqps://neoxhbgv:ObO_9mg7l72Qavudd_4cAgv5o4nkmklS@gorilla.lmq.cloudamqp.com/neoxhbgv',
  host: 'gorilla.lmq.cloudamqp.com',
  username: 'neoxhbgv',
  password: 'ObO_9mg7l72Qavudd_4cAgv5o4nkmklS',
  vhost: 'neoxhbgv',
  port: 5671,
};

async function testCloudAMQPConnection() {
  let connection = null;
  let channel = null;

  try {
    console.log('🔄 Testing CloudAMQP connection...');
    console.log(`📡 Host: ${cloudAmqpConfig.host}`);
    console.log(`👤 Username: ${cloudAmqpConfig.username}`);
    console.log(`🏠 VHost: ${cloudAmqpConfig.vhost}`);
    console.log(`🔌 Port: ${cloudAmqpConfig.port} (TLS)`);

    // Create connection
    connection = await amqp.connect(cloudAmqpConfig.url);
    console.log('✅ Connection established successfully!');

    // Create channel
    channel = await connection.createChannel();
    console.log('✅ Channel created successfully!');

    // Test queue creation
    const testQueue = 'test.connection.queue';
    await channel.assertQueue(testQueue, {
      durable: true,
      autoDelete: true,
    });
    console.log(`✅ Test queue "${testQueue}" created successfully!`);

    // Test exchange creation
    const testExchange = 'test.connection.exchange';
    await channel.assertExchange(testExchange, 'direct', {
      durable: false,
      autoDelete: true,
    });
    console.log(`✅ Test exchange "${testExchange}" created successfully!`);

    // Send test message
    const testMessage = JSON.stringify({
      timestamp: new Date().toISOString(),
      message: 'CloudAMQP connection test successful!',
      service: 'email-service-test',
    });

    await channel.publish(
      testExchange,
      'test.routing.key',
      Buffer.from(testMessage),
    );
    console.log('✅ Test message published successfully!');

    // Clean up test resources
    await channel.deleteQueue(testQueue);
    await channel.deleteExchange(testExchange);
    console.log('✅ Test resources cleaned up successfully!');

    console.log('\n🎉 CloudAMQP CONNECTION TEST PASSED! 🎉');
    console.log(
      'Your services can now connect to the production RabbitMQ instance.',
    );
  } catch (error) {
    console.error('❌ CloudAMQP connection test failed:', error.message);

    if (error.code === 'ENOTFOUND') {
      console.error(
        '🔍 DNS resolution failed. Check your internet connection.',
      );
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Connection refused. Check host and port.');
    } else if (error.code === 'EACCES') {
      console.error('🔍 Access denied. Check username and password.');
    }

    console.error('\n🔧 Troubleshooting:');
    console.error('1. Verify internet connection');
    console.error('2. Check credentials with your teammate');
    console.error('3. Ensure CloudAMQP instance is active');
  } finally {
    // Clean up connections
    try {
      if (channel) {
        await channel.close();
        console.log('🔒 Channel closed.');
      }
      if (connection) {
        await connection.close();
        console.log('🔒 Connection closed.');
      }
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
  }
}

// Run the test
console.log('🚀 Starting CloudAMQP Connection Test...\n');
testCloudAMQPConnection()
  .then(() => {
    console.log('\n✅ Test completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
