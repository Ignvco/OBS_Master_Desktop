@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo Ejecuta primero INSTALAR_WINDOWS.bat
  pause
  exit /b 1
)
echo Iniciando OBS MASTER en http://localhost:3000
call npm run dev
pause
