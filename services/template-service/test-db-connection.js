const { Pool, Client } = require('pg');

async function testRailwayDatabaseConnection() {
  console.log('🚂 Testing Railway PostgreSQL Connection...');

  // Railway PostgreSQL connection string
  const connectionString =
    'postgresql://postgres:UHTEsZprjEaPgeStWNWXIiLlJTLoNgEd@switchyard.proxy.rlwy.net:27606/railway';

  console.log('📡 Connecting to Railway PostgreSQL...');
  console.log('🔗 Host: switchyard.proxy.rlwy.net:27606');
  console.log('🗄️ Database: railway');

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Railway requires SSL
    },
  });

  try {
    console.log('🔌 Establishing connection...');
    await client.connect();

    console.log('✅ Railway PostgreSQL connection successful!');

    // Test basic query
    const result = await client.query(
      'SELECT NOW() as current_time, version() as pg_version, current_database() as database',
    );
    console.log('📊 Database info:');
    console.log('  ⏰ Current time:', result.rows[0].current_time);
    console.log(
      '  📝 PostgreSQL version:',
      result.rows[0].pg_version.split(' ')[0] +
        ' ' +
        result.rows[0].pg_version.split(' ')[1],
    );
    console.log('  🗄️ Database:', result.rows[0].database);

    // Test table creation (simulating template service schema)
    console.log('\n🏗️ Testing table creation capabilities...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table creation successful');

    // Test insert
    await client.query(`
      INSERT INTO connection_test (test_message) VALUES ('Railway connection test successful')
    `);
    console.log('✅ Data insertion successful');

    // Test select
    const testResult = await client.query(
      'SELECT * FROM connection_test ORDER BY created_at DESC LIMIT 1',
    );
    console.log(
      '✅ Data retrieval successful:',
      testResult.rows[0].test_message,
    );

    // Clean up test table
    await client.query('DROP TABLE IF EXISTS connection_test');
    console.log('✅ Cleanup successful');

    console.log('\n🎯 Railway PostgreSQL is ready for Template Service!');
    console.log('📋 Next steps:');
    console.log('  1. Add Redis service in Railway');
    console.log('  2. Configure environment variables in Railway dashboard');
    console.log('  3. Deploy Template Service');
  } catch (error) {
    console.error('❌ Railway PostgreSQL connection failed:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    console.error('  Detail:', error.detail);

    if (error.code === 'ENOTFOUND') {
      console.error('🔍 DNS resolution failed - check internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔍 Connection refused - check Railway service status');
    } else if (error.code === '28P01') {
      console.error('🔍 Authentication failed - check credentials');
    }
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

// Also test local environment setup
async function testLocalEnvironment() {
  console.log('\n📁 Testing local .env configuration...');
  require('dotenv').config();

  const envVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'DATABASE_URL',
  ];

  console.log('🔍 Environment variables:');
  envVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      console.log(
        `  ✅ ${varName}: ${varName.includes('PASSWORD') ? '***' : value}`,
      );
    } else {
      console.log(`  ❌ ${varName}: Not set`);
    }
  });
}

// Run tests
async function runAllTests() {
  await testRailwayDatabaseConnection();
  await testLocalEnvironment();
}

runAllTests();
