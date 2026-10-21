@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ===============================================================
echo   OBS MASTER V4.0 RC1 - DRAFT / PREVIEW / PUBLISH
 echo ===============================================================
echo.
where npm >nul 2>&1 || (echo ERROR: npm no disponible.& goto :fail)
if not exist node_modules (echo ERROR: dependencias ausentes. Ejecuta npm install primero.& goto :fail)
echo [1/4] TypeScript semantico...
call npm run lint || goto :fail
echo [2/4] Pruebas automatizadas y seguridad de publicacion...
call npm run test:core || goto :fail
echo [3/4] Build React y renderizador compartido...
call npm run build || goto :fail
echo [4/4] Servidor Electron sin Vite...
call npm run desktop:server || goto :fail
echo.
echo OK. Antes de distribuir ejecuta un ensayo privado con OBS real.
echo No borres tu ejecutable V3.9 RC2.
pause
exit /b 0
:fail
echo.
echo ERROR: no distribuyas V4.0 antes de corregir la prueba fallida.
pause
exit /b 1
