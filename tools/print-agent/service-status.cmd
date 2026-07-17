@echo off
setlocal

cd /d "%~dp0"

if exist "stelfaro-print-agent-service.exe" (
  stelfaro-print-agent-service.exe status
  echo.
)

sc query "StelfaroPrintAgent"
echo.
echo Salud:
curl http://localhost:8711/health
echo.
pause
