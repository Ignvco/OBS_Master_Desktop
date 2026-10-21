@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================
echo  SI TE DIJERA QUE - OBS MASTER V3.0.2
echo ============================================
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js 22 LTS y vuelve a ejecutar.
  pause
  exit /b 1
)

echo Instalando las dependencias del proyecto...
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo npm ci no pudo completar la instalacion.
  echo Se ejecutara la reparacion del package-lock y las verificaciones.
  call "%~dp0REPARAR_INSTALACION_WINDOWS.bat"
  if errorlevel 1 goto :fail
  exit /b 0
)
echo Instalacion completada. Ejecuta INICIAR_WINDOWS.bat.
pause
exit /b 0

:fail
echo La instalacion no pudo completarse. Revisa los mensajes anteriores.
pause
exit /b 1
