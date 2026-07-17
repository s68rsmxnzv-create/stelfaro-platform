@echo off
setlocal

cd /d "%~dp0"

set WRAPPER_EXE=%CD%\stelfaro-print-agent-service.exe

if not exist "%WRAPPER_EXE%" (
  echo No se encontro stelfaro-print-agent-service.exe
  pause
  exit /b 1
)

"%WRAPPER_EXE%" stop >nul 2>&1
"%WRAPPER_EXE%" uninstall

if errorlevel 1 (
  echo.
  echo No se pudo desinstalar el servicio.
  echo Ejecuta este script como Administrador.
  pause
  exit /b 1
)

echo.
echo Servicio eliminado correctamente.
echo.
pause
