@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OBS MASTER - Reparacion de dependencias y verificacion

echo ================================================
echo   SI TE DIJERA QUE - OBS MASTER V3.0.2
echo   Reparacion del package-lock en Windows
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro Node.js. Instala Node.js 22 LTS.
  goto :fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro npm.
  goto :fail
)
if not exist "package.json" (
  echo ERROR: Ejecuta este archivo en la carpeta del proyecto, junto a package.json.
  goto :fail
)

echo [1/6] Guardando copia del package-lock existente...
if exist "package-lock.json" (
  copy /Y "package-lock.json" "package-lock.backup-before-repair.json" >nul
  if errorlevel 1 goto :fail
  del /Q "package-lock.json"
  if errorlevel 1 goto :restore
)

echo [2/6] Regenerando el archivo de dependencias usando el registro npm...
call npm install --package-lock-only --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :restore

echo [3/6] Instalando las dependencias con npm ci...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :fail

echo [4/6] Verificando TypeScript...
call npm run lint
if errorlevel 1 goto :fail

echo [5/6] Ejecutando las pruebas...
call npm run test:core
if errorlevel 1 goto :fail

echo [6/6] Compilando la aplicacion...
call npm run build
if errorlevel 1 goto :fail

echo.
echo ================================================
echo  VALIDACION TERMINADA CORRECTAMENTE

echo  Ya puedes ejecutar INICIAR_WINDOWS.bat

echo ================================================
pause
exit /b 0

:restore
echo.
echo ERROR: No se pudo regenerar el archivo de dependencias.
echo Comprueba la conexion a Internet y el acceso a registry.npmjs.org.
if exist "package-lock.backup-before-repair.json" (
  copy /Y "package-lock.backup-before-repair.json" "package-lock.json" >nul
  echo Archivo anterior restaurado.
)
:fail
echo.
echo La reparacion no termino. No inicies una transmision publica todavia.
pause
exit /b 1
