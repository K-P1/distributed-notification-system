const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('Testing Database Connection...');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_NAME:', process.env.DB_NAME);

  // Try different connection methods
  const configs = [
    {
      name: 'With password',
      config: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionTimeoutMillis: 10000,
      },
    },
    {
      name: 'Without password (trust)',
      config: {
        host: '127.0.0.1',
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        connectionTimeoutMillis: 10000,
      },
    },
  ];

  for (const { name, config } of configs) {
    console.log(`\n--- Testing ${name} ---`);
    const pool = new Pool(config);

    try {
      const client = await pool.connect();
      console.log('✅ Database connection successful');

      const result = await client.query(
        'SELECT current_user, current_database(), version()',
      );
      console.log('✅ Query successful:', result.rows[0]);

      client.release();
      await pool.end();
      break; // Success, exit loop
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('Error code:', error.code);
      await pool.end();
    }
  }
}

testDatabaseConnection();
