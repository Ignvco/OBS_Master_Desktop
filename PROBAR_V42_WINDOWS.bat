@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo ============================================================
echo  OBS MASTER v4.2 RC1 - Validacion FASE 1 + FASE 2 en Windows
 echo  Este proceso NO modifica datos de AppData ni conecta OBS.
echo ============================================================
where node >nul 2>&1 || (echo ERROR: falta Node.js.& exit /b 1)
where npm >nul 2>&1 || (echo ERROR: falta npm.& exit /b 1)
if not exist node_modules\.bin\tsc.cmd (
 echo Instalando dependencias desde package-lock.json...
 call npm ci --include=optional --no-audit --no-fund || exit /b 1
)
echo.
echo [1/4] Tipos y componentes...
call npm run lint || exit /b 1
echo.
echo [2/4] Pruebas de publicacion, historial, OBS simulado y persistencia desktop...
call npm run test:core || exit /b 1
echo.
echo [3/4] Servidor de Electron...
call npm run desktop:server || exit /b 1
echo.
echo [4/4] Compilacion frontend (dependencias Windows)...
call npm run build || exit /b 1
echo.
echo Verificaciones automaticas aprobadas.
echo AUN falta realizar la prueba visual y la prueba de fuentes con OBS real.
echo Lee VALIDACION_V42_WINDOWS.md antes de transmitir.
exit /b 0
