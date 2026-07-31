@echo off
echo Starting server...
cd /d D:\VSC\UAR\server
start /b node server.js

timeout /t 2 /nobreak >nul

echo Starting frontend...
cd /d D:\VSC\UAR
call npm run serve