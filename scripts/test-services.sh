#!/usr/bin/env bash

# Test script for email and template services
set -e

echo "🧪 Testing Email and Template Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
TEMPLATE_SERVICE_URL="http://localhost:3002"
EMAIL_SERVICE_URL="http://localhost:3001"
API_GATEWAY_URL="http://localhost:8000"

# Function to check if service is running
check_service() {
    local service_name=$1
    local url=$2
    
    echo -e "${YELLOW}Checking ${service_name}...${NC}"
    
    if curl -sf "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ${service_name} is running${NC}"
        return 0
    else
        echo -e "${RED}✗ ${service_name} is not responding${NC}"
        return 1
    fi
}

# Function to test template creation
test_template_creation() {
    echo -e "${YELLOW}Testing template creation...${NC}"
    
    local response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
        -H "Content-Type: application/json" \
        -H "x-correlation-id: test-123" \
        -H "x-user-id: test-user" \
        -d '{
            "code": "welcome_email",
            "name": "Welcome Email Template",
            "type": "email",
            "subject": "Welcome to {{company_name}}!",
            "content": "<h1>Hello {{user_name}}!</h1><p>Welcome to {{company_name}}. We are excited to have you.</p>",
            "variables": ["user_name", "company_name"],
            "language": "en"
        }' \
        "$TEMPLATE_SERVICE_URL/templates")
    
    local http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$http_status" -eq 201 ]; then
        echo -e "${GREEN}✓ Template creation successful${NC}"
        echo "$body" | jq '.'
        return 0
    else
        echo -e "${RED}✗ Template creation failed (HTTP $http_status)${NC}"
        echo "$body"
        return 1
    fi
}

# Function to test template rendering
test_template_rendering() {
    echo -e "${YELLOW}Testing template rendering...${NC}"
    
    local response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
        -H "Content-Type: application/json" \
        -H "x-correlation-id: test-456" \
        -d '{
            "user_name": "John Doe",
            "company_name": "Acme Corp"
        }' \
        "$TEMPLATE_SERVICE_URL/templates/render/welcome_email")
    
    local http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    local body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$http_status" -eq 200 ]; then
        echo -e "${GREEN}✓ Template rendering successful${NC}"
        echo "$body" | jq '.'
        return 0
    else
        echo -e "${RED}✗ Template rendering failed (HTTP $http_status)${NC}"
        echo "$body"
        return 1
    fi
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    # Check if PostgreSQL is running
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "${RED}✗ PostgreSQL is not running${NC}"
        return 1
    fi
    
    # Check if Redis is running
    if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is running${NC}"
    else
        echo -e "${RED}✗ Redis is not running${NC}"
        return 1
    fi
    
    # Check if RabbitMQ is running
    if curl -sf http://localhost:15672 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ RabbitMQ is running${NC}"
    else
        echo -e "${RED}✗ RabbitMQ is not running${NC}"
        return 1
    fi
}

# Main test execution
main() {
    echo "🚀 Starting service readiness tests..."
    
    # Check dependencies first
    if ! check_dependencies; then
        echo -e "${RED}❌ Dependencies check failed. Please start required services.${NC}"
        echo "Run: docker-compose -f infra/docker-compose.yml up -d"
        exit 1
    fi
    
    # Check services
    local services_ok=true
    
    if ! check_service "Template Service" "$TEMPLATE_SERVICE_URL"; then
        services_ok=false
    fi
    
    if ! check_service "Email Service" "$EMAIL_SERVICE_URL"; then
        services_ok=false
    fi
    
    if [ "$services_ok" = false ]; then
        echo -e "${RED}❌ Some services are not running. Please start them first.${NC}"
        echo "Run: docker-compose -f docker-compose.dev.yml up -d"
        exit 1
    fi
    
    # Run functional tests
    echo -e "\n${YELLOW}Running functional tests...${NC}"
    
    if test_template_creation && test_template_rendering; then
        echo -e "\n${GREEN}🎉 All tests passed! Services are ready for testing.${NC}"
    else
        echo -e "\n${RED}❌ Some tests failed. Check the service logs.${NC}"
        exit 1
    fi
}

# Check if required tools are available
command -v curl >/dev/null 2>&1 || { echo "curl is required but not installed. Aborting." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq is required but not installed. Aborting." >&2; exit 1; }

main "$@"