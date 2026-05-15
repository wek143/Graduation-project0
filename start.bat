@echo off
cd /d "%~dp0"

echo Starting backend...
start "Backend" /d "%~dp0backend" cmd /k "mvn spring-boot:run -Dspring-boot.run.profiles=demo"

echo Starting frontend...
start "Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

echo Waiting for services to start...
timeout /t 20 /nobreak >nul

start http://localhost:5173
pause
