@echo off
rem Starts the RFQ service and restarts it if it exits. Keys come from the system environment variables or a .env file in this folder.
cd /d "%~dp0"
:loop
node server.js
echo Service stopped (exit %errorlevel%). Restarting in 10 seconds.
rem ping is used as the delay because "timeout" fails when there is no console (Task Scheduler, not logged on).
ping -n 11 127.0.0.1 >nul
goto loop
