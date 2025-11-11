const http = require("http");

console.log("🧪 Testing Email Service Dependencies...");

// Test 1: Check if Redis is accessible
async function testRedis() {
  try {
    const redis = require("redis");
    const client = redis.createClient({
      url: "redis://:redispassword@localhost:6379/0",
    });

    await client.connect();
    await client.ping();
    console.log("✅ Redis connection: SUCCESS");
    await client.quit();
  } catch (error) {
    console.log("❌ Redis connection: FAILED -", error.message);
  }
}

// Test 2: Check if RabbitMQ is accessible
function testRabbitMQ() {
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: 5672,
      timeout: 5000,
    };

    const req = http.request(options, () => {
      console.log("✅ RabbitMQ port 5672: ACCESSIBLE");
      resolve();
    });

    req.on("error", () => {
      console.log("❌ RabbitMQ port 5672: NOT ACCESSIBLE");
      resolve();
    });

    req.on("timeout", () => {
      console.log("❌ RabbitMQ port 5672: TIMEOUT");
      resolve();
    });

    req.end();
  });
}

// Test 3: Check if ports are available
function checkPorts() {
  const net = require("net");

  const checkPort = (port, name) => {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.listen(port, () => {
        console.log(`✅ Port ${port} (${name}): AVAILABLE`);
        server.close(resolve);
      });

      server.on("error", () => {
        console.log(`❌ Port ${port} (${name}): IN USE`);
        resolve();
      });
    });
  };

  return Promise.all([
    checkPort(3001, "Email Service"),
    checkPort(9090, "Metrics"),
  ]);
}

async function runTests() {
  console.log("\n🔍 Running Email Service Dependency Tests...\n");

  await testRedis();
  await testRabbitMQ();
  await checkPorts();

  console.log("\n✅ Dependency test completed!");
  process.exit(0);
}

runTests();
