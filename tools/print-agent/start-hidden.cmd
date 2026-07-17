@echo off
setlocal

cd /d "%~dp0"

set AGENT_EXE=%CD%\stelfaro-print-agent.exe
if not exist "%AGENT_EXE%" set AGENT_EXE=%CD%\dist\stelfaro-print-agent.exe

if not exist "%AGENT_EXE%" (
  echo No se encontro stelfaro-print-agent.exe
  pause
  exit /b 1
)

powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden -FilePath '%AGENT_EXE%'"
echo Stelfaro Print Agent iniciado en segundo plano.
echo Verifica en http://localhost:8711/health
pause
