@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ==========================================================
echo   OBS MASTER V3.8 RC2 - CONTENT INTEGRITY / REGRESSION
 echo ==========================================================
echo.
where npm >nul 2>&1 || (echo ERROR: Node.js y npm no disponibles.& goto :fail)
if not exist node_modules (echo ERROR: Instala primero las dependencias en esta carpeta.& goto :fail)
echo [1/4] TypeScript...
call npm run lint || goto :fail
echo [2/4] Integridad de contenido y regresion...
call npm run test:core || goto :fail
echo [3/4] React/Vite...
call npm run build || goto :fail
echo [4/4] Servidor de escritorio...
call npm run desktop:server || goto :fail
echo.
echo OK: comprobaciones de codigo aprobadas.
echo FALTA: validar editor y fuentes OBS reales, sin sustituir la version estable.
pause
exit /b 0
:fail
echo.
echo ERROR: no construyas ni instales el EXE V3.8 RC2.
pause
exit /b 1
