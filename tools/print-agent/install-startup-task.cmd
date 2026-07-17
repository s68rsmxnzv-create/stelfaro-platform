@echo off
setlocal

cd /d "%~dp0"

set AGENT_DIR=%CD%
set AGENT_EXE=%AGENT_DIR%\stelfaro-print-agent.exe
if not exist "%AGENT_EXE%" set AGENT_EXE=%AGENT_DIR%\dist\stelfaro-print-agent.exe

if not exist "%AGENT_EXE%" (
  echo No se encontro stelfaro-print-agent.exe
  echo Copia el ejecutable en esta carpeta o en dist\
  pause
  exit /b 1
)

schtasks /Create ^
  /TN "Stelfaro Print Agent" ^
  /TR "\"%AGENT_EXE%\"" ^
  /SC ONLOGON ^
  /RL LIMITED ^
  /F

if errorlevel 1 (
  echo.
  echo No se pudo registrar la tarea de inicio.
  pause
  exit /b 1
)

echo.
echo Tarea de inicio registrada: Stelfaro Print Agent
echo Se ejecutara al iniciar sesion de Windows.
echo.
echo Para iniciarlo ahora, ejecuta:
echo   start-hidden.cmd
echo.
pause
