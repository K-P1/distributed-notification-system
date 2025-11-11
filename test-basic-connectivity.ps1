#!/usr/bin/env pwsh

Write-Host "=== Testing Infrastructure Connectivity ===" -ForegroundColor Green

# Test PostgreSQL
Write-Host "`n1. Testing PostgreSQL Connection..." -ForegroundColor Cyan
try {
    $pgResult = docker exec postgres psql -U gateway_user -d gateway_db -c "SELECT version();" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL: Connected successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL: Connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ PostgreSQL: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Redis
Write-Host "`n2. Testing Redis Connection..." -ForegroundColor Cyan
try {
    $redisResult = docker exec redis redis-cli -a redispassword ping 2>$null
    if ($redisResult -eq "PONG") {
        Write-Host "✅ Redis: Connected successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis: Connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test RabbitMQ
Write-Host "`n3. Testing RabbitMQ Connection..." -ForegroundColor Cyan
try {
    $rabbitResult = docker exec rabbitmq rabbitmq-diagnostics ping 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ RabbitMQ: Connected successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ RabbitMQ: Connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ RabbitMQ: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Template Service Health Endpoint
Write-Host "`n4. Testing Template Service (if running)..." -ForegroundColor Cyan
try {
    $templateResult = Invoke-RestMethod -Uri "http://localhost:3002/api/v1/health" -Method GET -TimeoutSec 5 2>$null
    Write-Host "✅ Template Service: Responding on port 3002" -ForegroundColor Green
    Write-Host "   Status: $($templateResult.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Template Service: Not responding (service may not be started)" -ForegroundColor Yellow
}

# Test Email Service Health Endpoint
Write-Host "`n5. Testing Email Service (if running)..." -ForegroundColor Cyan
try {
    $emailResult = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 5 2>$null
    Write-Host "✅ Email Service: Responding on port 3001" -ForegroundColor Green
    Write-Host "   Status: $($emailResult.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Email Service: Not responding (service may not be started)" -ForegroundColor Yellow
}

# Test port availability
Write-Host "`n6. Testing Port Availability..." -ForegroundColor Cyan
$ports = @(3001, 3002, 5432, 6379, 5672, 15672)
foreach ($port in $ports) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $result = $tcpClient.ConnectAsync("localhost", $port).Wait(1000)
        if ($result) {
            Write-Host "✅ Port $port`: Available" -ForegroundColor Green
        } else {
            Write-Host "❌ Port $port`: Not available" -ForegroundColor Red
        }
        $tcpClient.Close()
    } catch {
        Write-Host "❌ Port $port`: Not available" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Summary Complete ===" -ForegroundColor Green
Write-Host "Infrastructure services should be ready for application testing." -ForegroundColor Gray