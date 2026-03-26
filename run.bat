@echo off
setlocal

rem Change to the directory where this script is located
cd /d "%~dp0"

echo Starting backend (API + Socket.io)...
start "Backend - smart-question-api" /D "%~dp0backend" cmd /k "npm run dev"

echo Starting frontend (React/Vite)...
start "Frontend - smart-question-frontend" /D "%~dp0frontend" cmd /k "npm run dev -- --host 0.0.0.0"

echo.
echo Backend and frontend have been started in separate windows.
echo On this machine, open:   http://localhost:3000
echo From another device on the same network, use: http://^<this-PC-IP^>:3000
echo.
pause

