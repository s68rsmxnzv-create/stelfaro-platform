@echo off
setlocal
cd /d "%~dp0"
if "%PRINT_AGENT_PRINTERS%"=="" set PRINT_AGENT_PRINTERS=Termica
node src\server.js
