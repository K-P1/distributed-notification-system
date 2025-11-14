# Test Template Service (PowerShell)

Write-Host "Testing Template Service..." -ForegroundColor Green
Write-Host ""

# Wait for service to be ready
Write-Host "Waiting for service to be ready..."
Start-Sleep -Seconds 5

# Health check
Write-Host "1. Health Check" -ForegroundColor Yellow
$healthResponse = Invoke-RestMethod -Uri "http://localhost:8002/health" -Method Get
$healthResponse | ConvertTo-Json -Depth 10
Write-Host ""

# Create a template
Write-Host "2. Create Template" -ForegroundColor Yellow
$createTemplateBody = @{
    code = "welcome_email"
    language = "en"
    subject = "Welcome {{name}}!"
    body_html = "<h1>Hello {{name}}</h1><p>Thank you for joining us. Click <a href='{{link}}'>here</a> to get started.</p>"
    body_text = "Hello {{name}}! Thank you for joining us. Visit: {{link}}"
} | ConvertTo-Json

$headers = @{
    "X-API-Key" = "test"
    "Content-Type" = "application/json"
}

$templateResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/" -Method Post -Headers $headers -Body $createTemplateBody
$templateResponse | ConvertTo-Json -Depth 10
$templateId = $templateResponse.data.id
Write-Host "Created template with ID: $templateId" -ForegroundColor Green
Write-Host ""

# Get template by ID
Write-Host "3. Get Template by ID" -ForegroundColor Yellow
$getResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/$templateId" -Method Get -Headers @{"X-API-Key" = "test"}
$getResponse | ConvertTo-Json -Depth 10
Write-Host ""

# Get template by code
Write-Host "4. Get Template by Code" -ForegroundColor Yellow
$byCodeResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/code/welcome_email?language=en" -Method Get -Headers @{"X-API-Key" = "test"}
$byCodeResponse | ConvertTo-Json -Depth 10
Write-Host ""

# Render template
Write-Host "5. Render Template" -ForegroundColor Yellow
$renderBody = @{
    variables = @{
        name = "John Doe"
        link = "https://example.com/get-started"
    }
} | ConvertTo-Json

$renderResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/code/welcome_email/render?language=en" -Method Post -Headers $headers -Body $renderBody
$renderResponse | ConvertTo-Json -Depth 10
Write-Host ""

# Create another template
Write-Host "6. Create Password Reset Template" -ForegroundColor Yellow
$passwordResetBody = @{
    code = "password_reset"
    language = "en"
    subject = "Reset Your Password"
    body_html = "<h1>Password Reset Request</h1><p>Click <a href='{{reset_link}}'>here</a> to reset your password.</p>"
    body_text = "Password Reset Request. Visit: {{reset_link}}"
} | ConvertTo-Json

$template2Response = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/" -Method Post -Headers $headers -Body $passwordResetBody
$template2Response | ConvertTo-Json -Depth 10
Write-Host ""

# List templates
Write-Host "7. List Templates" -ForegroundColor Yellow
$listResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/" -Method Get -Headers @{"X-API-Key" = "test"}
$listResponse | ConvertTo-Json -Depth 10
Write-Host ""

# Update template
Write-Host "8. Update Template" -ForegroundColor Yellow
$updateBody = @{
    subject = "Welcome to Our Platform {{name}}!"
    body_html = "<h1>Welcome {{name}}!</h1><p>We're excited to have you. <a href='{{link}}'>Get Started</a></p>"
} | ConvertTo-Json

$updateResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/templates/$templateId" -Method Put -Headers $headers -Body $updateBody
$updateResponse | ConvertTo-Json -Depth 10
Write-Host "Template version after update: $($updateResponse.data.version)" -ForegroundColor Cyan
Write-Host ""

Write-Host "All tests completed!" -ForegroundColor Green
