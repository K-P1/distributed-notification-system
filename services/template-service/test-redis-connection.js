// Redis connection test for Template Service
const redis = require('redis');

async function testRedisConnection() {
  console.log('🔴 Testing Railway Redis Connection...');
  
  // Railway Redis connection string
  const redisUrl = 'redis://default:duXgrrPLxBMnbTQsBOvYamYiptOWFNuL@shortline.proxy.rlwy.net:27369';
  
  console.log('📡 Connecting to Railway Redis...');
  console.log('🔗 Host: shortline.proxy.rlwy.net:27369');

  const client = redis.createClient({
    url: redisUrl
  });

  client.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
  });

  try {
    console.log('🔌 Establishing connection...');
    await client.connect();
    
    console.log('✅ Railway Redis connection successful!');
    
    // Test basic operations
    console.log('\n🧪 Testing Redis operations...');
    
    // Test SET
    await client.set('test_key', 'Railway Redis test successful');
    console.log('✅ SET operation successful');
    
    // Test GET
    const value = await client.get('test_key');
    console.log('✅ GET operation successful:', value);
    
    // Test DELETE
    await client.del('test_key');
    console.log('✅ DELETE operation successful');
    
    // Test info
    const info = await client.info('server');
    const redisVersion = info.split('\r\n').find(line => line.startsWith('redis_version'));
    console.log('📊 Redis info:', redisVersion);
    
    console.log('\n🎯 Railway Redis is ready for Template Service!');
    
  } catch (error) {
    console.error('❌ Railway Redis connection failed:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.error('🔍 DNS resolution failed - check internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Connection refused - check Railway Redis service status');
    } else if (error.message.includes('AUTH')) {
      console.error('🔍 Authentication failed - check Redis password');
    }
  } finally {
    await client.disconnect();
    console.log('🔌 Redis connection closed');
  }
}

// Test both connections
async function testBothConnections() {
  console.log('🧪 Testing both PostgreSQL and Redis connections...\n');
  
  // Test PostgreSQL (reuse existing test)
  const { Client } = require('pg');
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:UHTEsZprjEaPgeStWNWXIiLlJTLoNgEd@switchyard.proxy.rlwy.net:27606/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await pgClient.connect();
    console.log('✅ PostgreSQL: Connected');
    await pgClient.end();
  } catch (error) {
    console.error('❌ PostgreSQL: Failed -', error.message);
  }
  
  // Test Redis
  await testRedisConnection();
  
  console.log('\n🎯 Connection test complete!');
}

testBothConnections();