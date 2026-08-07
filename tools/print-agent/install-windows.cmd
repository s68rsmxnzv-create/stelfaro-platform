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
set EXPECTED_VERSION=0.2.10

echo Deteniendo cualquier version anterior...
if exist "%TARGET%\stelfaro-print-agent-service.exe" (
  "%TARGET%\stelfaro-print-agent-service.exe" stop >nul 2>&1
)
schtasks /Delete /TN "Stelfaro Print Agent" /F >nul 2>&1
taskkill /IM stelfaro-print-agent.exe /F >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8711" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "%TARGET%" mkdir "%TARGET%"
if /I not "%~dp0"=="%TARGET%\" (
  xcopy "%~dp0*" "%TARGET%\" /E /I /Y /R >nul
  if errorlevel 1 (
    echo No se pudieron reemplazar los archivos del agente anterior.
    echo Reinicia Windows y ejecuta nuevamente este instalador.
    pause
    exit /b 1
  )
)

echo.
echo Stelfaro Print Agent copiado en %TARGET%
echo Instalando el servicio automatico...
echo.
call "%TARGET%\install-service.cmd"
if errorlevel 1 exit /b 1

echo Verificando version instalada...
set INSTALLED_VERSION=
for /f "usebackq delims=" %%V in (`powershell.exe -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; Start-Sleep -Seconds 2; (Invoke-RestMethod -Uri 'http://localhost:8711/health?install=%EXPECTED_VERSION%' -Headers @{'Cache-Control'='no-cache'} -TimeoutSec 5).version"`) do set INSTALLED_VERSION=%%V
if /I not "%INSTALLED_VERSION%"=="%EXPECTED_VERSION%" (
  echo.
  echo La actualizacion no se completo. Version esperada: %EXPECTED_VERSION%. Version activa: %INSTALLED_VERSION%
  echo Reinicia Windows y vuelve a ejecutar install-windows.cmd como administrador.
  pause
  exit /b 1
)

echo Version %INSTALLED_VERSION% instalada y activa.
