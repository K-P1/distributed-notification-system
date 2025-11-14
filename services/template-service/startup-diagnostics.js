// Template Service startup diagnostics
console.log('🔍 Template Service Startup Diagnostics\n');

// Check environment variables
const requiredVars = [
  'NODE_ENV', 'PORT', 'DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
  'REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'
];

console.log('📋 Environment Variables Check:');
const missingVars = [];
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const displayValue = varName.includes('PASSWORD') || varName.includes('URL') ? '***' : value;
    console.log(`  ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`  ❌ ${varName}: Missing`);
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log(`\n⚠️  Missing ${missingVars.length} required environment variables:`);
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n🔧 Add these variables in Railway dashboard Variables tab');
} else {
  console.log('\n✅ All required environment variables are present');
}

// Check if we're in Railway environment
if (process.env.RAILWAY_PROJECT_ID) {
  console.log('\n🚂 Railway Environment Detected');
  console.log(`  Project ID: ${process.env.RAILWAY_PROJECT_ID}`);
  console.log(`  Service ID: ${process.env.RAILWAY_SERVICE_ID || 'Not set'}`);
} else {
  console.log('\n💻 Local Development Environment');
}

// Test database connections
async function testConnections() {
  console.log('\n🔗 Testing Connections...');
  
  // Test PostgreSQL
  try {
    const { Client } = require('pg');
    const pgClient = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    await pgClient.connect();
    await pgClient.query('SELECT 1');
    await pgClient.end();
    console.log('  ✅ PostgreSQL: Connected');
  } catch (error) {
    console.log(`  ❌ PostgreSQL: ${error.message}`);
  }
  
  // Test Redis
  try {
    const redis = require('redis');
    const redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    await redisClient.ping();
    await redisClient.disconnect();
    console.log('  ✅ Redis: Connected');
  } catch (error) {
    console.log(`  ❌ Redis: ${error.message}`);
  }
}

// Run diagnostics
testConnections().then(() => {
  console.log('\n🎯 Diagnostics complete!');
  console.log('If all connections are successful, the Template Service should start properly.');
}).catch(error => {
  console.error('\n💥 Diagnostics failed:', error.message);
});