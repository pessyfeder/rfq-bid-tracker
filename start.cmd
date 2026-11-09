@echo off
rem Starts the RFQ service. Keys and the token come from the system environment variables or a .env file in this folder.
cd /d "%~dp0"
:loop
node server.js
echo Service stopped (exit %errorlevel%). Restarting in 10 seconds; close this window to stop.
timeout /t 10 /nobreak >nul
goto loop
