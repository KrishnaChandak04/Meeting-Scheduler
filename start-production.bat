@echo off
echo Starting Meeting Scheduler Pro - Production Server
echo.
echo Checking dependencies...
call npm list --silent > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting server...
echo Production server will be available at: http://localhost:5000
echo Frontend will be available at: http://localhost:3000
echo.
node src/app-production.js
pause
