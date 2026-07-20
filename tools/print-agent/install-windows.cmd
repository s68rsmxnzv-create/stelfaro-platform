@echo off
setlocal

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo Solicitando permisos de administrador...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set TARGET=C:\print-agent

if not exist "%TARGET%" mkdir "%TARGET%"
if /I not "%~dp0"=="%TARGET%\" xcopy "%~dp0*" "%TARGET%\" /E /I /Y >nul

echo.
echo Stelfaro Print Agent copiado en %TARGET%
echo Instalando el servicio automatico...
echo.
call "%TARGET%\install-service.cmd"
