@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo  ==============================================
echo    SI TE DIJERA QUE?  OBS MASTER  DESKTOP
 echo   Construccion de instalador Windows x64
 echo  ==============================================
 echo.
where node >nul 2>&1 || (echo ERROR: Instala Node.js LTS.& goto :fail)
where npm >nul 2>&1 || (echo ERROR: npm no encontrado.& goto :fail)
if not exist node_modules (echo Dependencias de React ausentes. Ejecutando npm install...& call npm install || goto :fail)
echo [1/6] TypeScript...
call npm run lint || goto :fail
echo [2/6] Pruebas...
call npm run test:core || goto :fail
echo [3/6] Generando frontend Vite...
call npm run build || goto :fail
echo [4/6] Compilando servidor standalone...
call node_modules\.bin\tsc.cmd -p tsconfig.desktop.json || goto :fail
echo [5/6] Copiando build a Electron...
if exist desktop-app\dist rmdir /s /q desktop-app\dist
xcopy /e /i /q dist desktop-app\dist >nul || goto :fail
echo [6/6] Empaquetando Electron...
cd /d "%~dp0desktop-app"
rem Version desktop 3.7: sincronizar su lock antes de npm ci para evitar EUSAGE.
rem El lock del frontend permanece intacto.
if exist package-lock.json (
  call npm install --package-lock-only --include=optional --no-audit --no-fund || goto :fail
  call npm ci --no-audit --no-fund || goto :fail
) else (
  call npm install --include=optional --no-audit --no-fund || goto :fail
)
if errorlevel 1 goto :fail
echo Verificando extraccion temporal de Electron...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LIMPIAR_STAGING_ELECTRON_UX_V42_WINDOWS.ps1" || goto :fail
echo Ejecutando electron-builder...
call npm run dist:win || goto :build_locked
 echo.
 echo OK: revisa desktop-app\release\
 explorer "%~dp0desktop-app\release"
 pause
exit /b 0
:build_locked
echo.
echo ERROR en electron-builder. Si aparece EPERM renombrando win-unpacked.tmp:
echo 1. Cierra VS Code, Cursor, Electron y Explorer abierto en release.
echo 2. Actualiza la rama UX para aplicar la exclusion del watcher.
echo 3. Vuelve a ejecutar el empaquetado fuera de emision.
echo Si persiste, revisa Seguridad de Windows y prueba un clon en C:\dev.
echo NO desactives Defender ni borres AppData.
goto :fail
:fail
echo.
echo ERROR al construir. No se ha generado un instalador validado.
pause
exit /b 1
