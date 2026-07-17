@echo off
setlocal
cd /d "%~dp0"
if "%PRINT_AGENT_PRINTERS%"=="" set PRINT_AGENT_PRINTERS=Termica
set PRINT_AGENT_DRY_RUN=1
node src\server.js
