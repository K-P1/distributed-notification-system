@echo off
REM Run code quality checks for API Gateway service only

echo ======================================
echo API Gateway - Code Quality Checks
echo ======================================

cd /d "%~dp0"

echo.
echo [1/2] Running Ruff lint and format check (excluding tests)...
ruff check app --fix --unsafe-fixes
if %errorlevel% neq 0 (
    echo [ERROR] Ruff lint failed!
    exit /b %errorlevel%
)

ruff format app
if %errorlevel% neq 0 (
    echo [ERROR] Ruff format failed!
    exit /b %errorlevel%
)
echo [OK] Ruff checks and formatting passed

echo.
echo [2/2] Running Mypy type checks...
uv run mypy app --ignore-missing-imports --no-strict-optional
if %errorlevel% neq 0 (
    echo [ERROR] Mypy failed!
    exit /b %errorlevel%
)
echo [OK] Mypy checks passed

echo.
echo ======================================
echo All checks passed successfully!
echo ======================================
