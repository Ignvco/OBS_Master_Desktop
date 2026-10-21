@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo =============================================================
echo   OBS MASTER V3.9 RC1 - REGISTRO DE GRAFICAS INDEPENDIENTES
 echo =============================================================
echo.
where npm >nul 2>&1 || (echo ERROR: Node.js y npm no disponibles.& goto :fail)
if not exist node_modules (echo ERROR: Instala las dependencias antes de verificar.& goto :fail)
echo [1/4] Analisis TypeScript...
call npm run lint || goto :fail
echo [2/4] Pruebas automatizadas...
call npm run test:core || goto :fail
echo [3/4] Compilando interfaz React...
call npm run build || goto :fail
echo [4/4] Compilando servidor Electron...
call npm run desktop:server || goto :fail
echo.
echo OK: codigo compilado. Ahora prueba fuentes reales de OBS y respaldos.
echo No reemplaces tu .exe estable hasta verificarlo en Windows.
pause
exit /b 0
:fail
echo.
echo ERROR: no generes ni instales la V3.9 sin corregir este resultado.
pause
exit /b 1
