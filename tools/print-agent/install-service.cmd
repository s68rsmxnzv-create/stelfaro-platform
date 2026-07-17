@echo off
setlocal

cd /d "%~dp0"

set WRAPPER_EXE=%CD%\stelfaro-print-agent-service.exe
set WRAPPER_XML=%CD%\stelfaro-print-agent-service.xml
set AGENT_EXE=%CD%\dist\stelfaro-print-agent.exe
set WINSW_URL=https://github.com/winsw/winsw/releases/latest/download/WinSW-x64.exe

if not exist "%AGENT_EXE%" (
  echo No se encontro dist\stelfaro-print-agent.exe
  echo Empaqueta o copia primero el agente.
  pause
  exit /b 1
)

if not exist "%WRAPPER_XML%" (
  echo No se encontro stelfaro-print-agent-service.xml
  pause
  exit /b 1
)

if not exist "%WRAPPER_EXE%" (
  echo Descargando WinSW...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '%WINSW_URL%' -OutFile '%WRAPPER_EXE%'"

  if errorlevel 1 (
    echo.
    echo No se pudo descargar WinSW.
    echo Descargalo manualmente y guardalo como:
    echo   %WRAPPER_EXE%
    pause
    exit /b 1
  )
)

echo Instalando servicio de Windows...
"%WRAPPER_EXE%" stop >nul 2>&1
"%WRAPPER_EXE%" uninstall >nul 2>&1
"%WRAPPER_EXE%" install
if errorlevel 1 (
  echo.
  echo No se pudo instalar el servicio.
  echo Ejecuta este script como Administrador.
  pause
  exit /b 1
)

echo Iniciando servicio...
"%WRAPPER_EXE%" start
if errorlevel 1 (
  echo.
  echo El servicio se instalo pero no pudo iniciar.
  echo Revisa los logs en la carpeta logs\
  pause
  exit /b 1
)

echo.
echo Servicio instalado correctamente.
echo Nombre: Stelfaro Print Agent
echo Salud: http://localhost:8711/health
echo.
pause
