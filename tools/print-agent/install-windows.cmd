@echo off
setlocal

set TARGET=C:\print-agent

if not exist "%TARGET%" mkdir "%TARGET%"
xcopy "%~dp0*" "%TARGET%\" /E /I /Y >nul

echo.
echo Stelfaro Print Agent copiado en %TARGET%
echo.
echo Para instalar como servicio:
echo   cd %TARGET%
echo   install-service.cmd
echo.
pause
