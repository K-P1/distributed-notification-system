#!/usr/bin/env pwsh

Write-Host "=== Template Service Configuration Test ===" -ForegroundColor Green

# Navigate to template service directory
Set-Location "services\template-service"

# Test environment loading
Write-Host "`n1. Testing Environment Variable Loading..." -ForegroundColor Cyan

# Create a simple Node.js script to test env loading
@"
require('dotenv').config();
console.log('Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') : 'undefined');
"@ | Out-File -FilePath "test-env.js"

# Run the test
node test-env.js

# Clean up
Remove-Item "test-env.js"

# Test PostgreSQL connection from the service directory
Write-Host "`n2. Testing PostgreSQL Connection from Service Context..." -ForegroundColor Cyan
Set-Location "..\..\"
$env:PGPASSWORD = "gatewaypassword"
$result = & psql -h localhost -p 5432 -U gateway_user -d gateway_db -c "SELECT current_user, current_database();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Direct PostgreSQL connection successful" -ForegroundColor Green
} else {
    Write-Host "❌ Direct PostgreSQL connection failed: $result" -ForegroundColor Red
}

Write-Host "`n=== Configuration Test Complete ===" -ForegroundColor Green