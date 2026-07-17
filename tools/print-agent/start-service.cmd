@echo off
setlocal

cd /d "%~dp0"

if not exist "stelfaro-print-agent-service.exe" (
  echo No se encontro stelfaro-print-agent-service.exe
  pause
  exit /b 1
)

stelfaro-print-agent-service.exe start
pause
