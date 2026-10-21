@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ===============================================================
echo  OBS MASTER V3.9 RC2 - MOTOR DE CAPAS UNIFICADAS
 echo ===============================================================
echo.
where npm >nul 2>&1 || (echo ERROR: npm no disponible. & goto :fail)
if not exist node_modules (echo ERROR: Falta node_modules. Instala dependencias del proyecto. & goto :fail)
echo [1/4] Verificacion TypeScript (lint)...
call npm run lint || goto :fail
echo [2/4] Pruebas de regresion, orden de capas y compatibilidad...
call npm run test:core || goto :fail
echo [3/4] Build del editor y renderizador OBS...
call npm run build || goto :fail
echo [4/4] Compilacion del servidor de escritorio...
call npm run desktop:server || goto :fail
echo.
echo OK: verificaciones tecnicas terminadas. Falta la prueba visual en OBS.
echo Conserva el .exe anterior hasta verificar los componentes en Windows.
pause
exit /b 0
:fail
echo.
echo ERROR: NO recompiles ni reemplaces el .exe estable hasta corregir el fallo.
pause
exit /b 1
