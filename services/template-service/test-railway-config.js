const { Pool } = require('pg');

// Test the DATABASE_URL parsing just like our updated config service
async function testDatabaseConnection() {
  console.log('🧪 Testing Railway DATABASE_URL parsing...');
  
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:UHTEsZprjEaPgeStWNWXIiLlJTLoNgEd@switchyard.proxy.rlwy.net:27606/railway';
  
  console.log('📍 Database URL:', databaseUrl.replace(/:([^:@]+)@/, ':***@'));
  
  try {
    // Parse URL just like our config service
    const url = new URL(databaseUrl);
    console.log('✅ URL Parsing:');
    console.log('  - Host:', url.hostname);
    console.log('  - Port:', url.port);
    console.log('  - Database:', url.pathname.slice(1));
    console.log('  - Username:', url.username);
    console.log('  - SSL Required:', databaseUrl.includes('railway') ? 'Yes' : 'No');
    
    console.log('\\n🔗 Testing connection with new configuration...');
    
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // 30 seconds
      query_timeout: 60000, // 60 second query timeout
      statement_timeout: 60000, // 60 second statement timeout
      ssl: databaseUrl.includes('railway') ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    try {
      console.log('✅ Connection successful!');
      
      // Test basic query
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('✅ Query successful!');
      console.log('  - Current time:', result.rows[0].current_time);
      console.log('  - PostgreSQL version:', result.rows[0].pg_version.split(',')[0]);
      
      // Test CREATE TABLE (just check syntax)
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ CREATE TABLE test successful!');
      
      // Clean up
      await client.query('DROP TABLE IF EXISTS test_table');
      console.log('✅ Cleanup successful!');
      
    } finally {
      client.release();
    }
    
    await pool.end();
    console.log('\\n🎉 All tests passed! Railway configuration should work.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testDatabaseConnection();