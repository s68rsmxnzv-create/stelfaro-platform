@echo off
setlocal
cd /d "%~dp0"
if "%PRINT_AGENT_PRINTERS%"=="" set PRINT_AGENT_PRINTERS=Termica
if exist "stelfaro-print-agent.exe" (
  stelfaro-print-agent.exe
  exit /b %ERRORLEVEL%
)
if exist "dist\stelfaro-print-agent.exe" (
  dist\stelfaro-print-agent.exe
  exit /b %ERRORLEVEL%
)
echo No se encontro stelfaro-print-agent.exe
pause
