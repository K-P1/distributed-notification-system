const { Pool } = require("pg");

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  user: "template_user",
  password: "password123",
  database: "template_db",
});

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const client = await pool.connect();
    console.log("✅ Connected successfully!");

    const result = await client.query(
      "SELECT current_user, current_database(), version()"
    );
    console.log("Database info:", result.rows[0]);

    client.release();
    await pool.end();
    console.log("Connection test completed.");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
