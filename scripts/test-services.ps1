# PowerShell Test Script for Email and Template Services

param(
    [switch]$CheckDependencies,
    [switch]$TestServices,
    [switch]$All
)

# Configuration
$TEMPLATE_SERVICE_URL = "http://localhost:3002"
$EMAIL_SERVICE_URL = "http://localhost:3001"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-ServiceHealth($ServiceName, $Url) {
    Write-ColorOutput Yellow "Checking $ServiceName..."
    
    try {
        $response = Invoke-RestMethod -Uri "$Url/health" -Method GET -TimeoutSec 5
        Write-ColorOutput Green "✓ $ServiceName is running"
        return $true
    }
    catch {
        Write-ColorOutput Red "✗ $ServiceName is not responding"
        Write-ColorOutput Red "Error: $($_.Exception.Message)"
        return $false
    }
}

function Test-Dependencies {
    Write-ColorOutput Yellow "Checking dependencies..."
    
    $allGood = $true
    
    # Check PostgreSQL
    try {
        $null = Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet
        Write-ColorOutput Green "✓ PostgreSQL is running"
    }
    catch {
        Write-ColorOutput Red "✗ PostgreSQL is not running"
        $allGood = $false
    }
    
    # Check Redis
    try {
        $null = Test-NetConnection -ComputerName "localhost" -Port 6379 -InformationLevel Quiet
        Write-ColorOutput Green "✓ Redis is running"
    }
    catch {
        Write-ColorOutput Red "✗ Redis is not running"
        $allGood = $false
    }
    
    # Check RabbitMQ
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:15672" -Method GET -TimeoutSec 5
        Write-ColorOutput Green "✓ RabbitMQ is running"
    }
    catch {
        Write-ColorOutput Red "✗ RabbitMQ is not running"
        $allGood = $false
    }
    
    return $allGood
}

function Test-TemplateCreation {
    Write-ColorOutput Yellow "Testing template creation..."
    
    $body = @{
        code = "welcome_email_test"
        name = "Welcome Email Template Test"
        type = "email"
        subject = "Welcome to {{company_name}}!"
        content = "<h1>Hello {{user_name}}!</h1><p>Welcome to {{company_name}}. We are excited to have you.</p>"
        variables = @("user_name", "company_name")
        language = "en"
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
        "x-correlation-id" = "test-123"
        "x-user-id" = "test-user"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$TEMPLATE_SERVICE_URL/templates" -Method POST -Body $body -Headers $headers
        Write-ColorOutput Green "✓ Template creation successful"
        $response | ConvertTo-Json -Depth 4
        return $true
    }
    catch {
        Write-ColorOutput Red "✗ Template creation failed"
        Write-ColorOutput Red "Error: $($_.Exception.Message)"
        return $false
    }
}

function Test-TemplateRendering {
    Write-ColorOutput Yellow "Testing template rendering..."
    
    $body = @{
        user_name = "John Doe"
        company_name = "Acme Corp"
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
        "x-correlation-id" = "test-456"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$TEMPLATE_SERVICE_URL/templates/render/welcome_email_test" -Method POST -Body $body -Headers $headers
        Write-ColorOutput Green "✓ Template rendering successful"
        $response | ConvertTo-Json -Depth 4
        return $true
    }
    catch {
        Write-ColorOutput Red "✗ Template rendering failed"
        Write-ColorOutput Red "Error: $($_.Exception.Message)"
        return $false
    }
}

function Main {
    Write-ColorOutput Cyan "🧪 Testing Email and Template Services..."
    
    if ($CheckDependencies -or $All) {
        if (-not (Test-Dependencies)) {
            Write-ColorOutput Red "❌ Dependencies check failed. Please start required services."
            Write-ColorOutput Yellow "Run: docker-compose -f infra/docker-compose.yml up -d"
            exit 1
        }
    }
    
    if ($TestServices -or $All) {
        # Check services
        $servicesOk = $true
        
        if (-not (Test-ServiceHealth "Template Service" $TEMPLATE_SERVICE_URL)) {
            $servicesOk = $false
        }
        
        if (-not (Test-ServiceHealth "Email Service" $EMAIL_SERVICE_URL)) {
            $servicesOk = $false
        }
        
        if (-not $servicesOk) {
            Write-ColorOutput Red "❌ Some services are not running. Please start them first."
            Write-ColorOutput Yellow "Run: docker-compose -f docker-compose.dev.yml up -d"
            exit 1
        }
        
        # Run functional tests
        Write-ColorOutput Yellow "`nRunning functional tests..."
        
        if ((Test-TemplateCreation) -and (Test-TemplateRendering)) {
            Write-ColorOutput Green "`n🎉 All tests passed! Services are ready for testing."
        } else {
            Write-ColorOutput Red "`n❌ Some tests failed. Check the service logs."
            exit 1
        }
    }
    
    if (-not $CheckDependencies -and -not $TestServices -and -not $All) {
        Write-ColorOutput Yellow "Usage:"
        Write-ColorOutput White "  .\test-services.ps1 -CheckDependencies    # Check if dependencies are running"
        Write-ColorOutput White "  .\test-services.ps1 -TestServices         # Test service functionality"
        Write-ColorOutput White "  .\test-services.ps1 -All                  # Run all tests"
    }
}

Main