@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title OBS MASTER V4.2 - Candidato UX para Windows

echo =========================================================
echo   OBS MASTER V4.2 UX - PREPARACION DE CANDIDATO WINDOWS
echo =========================================================
echo.
echo Este procedimiento NO instala el producto, NO abre OBS,
echo NO modifica main ni crea una publicacion en GitHub.
echo Ejecuta SOLO en la copia experimental de la rama UX.
echo.

where git >nul 2>&1 || (echo ERROR: instala Git for Windows.& exit /b 1)
where node >nul 2>&1 || (echo ERROR: instala Node.js 22 LTS.& exit /b 1)
where npm >nul 2>&1 || (echo ERROR: npm no disponible.& exit /b 1)
where powershell >nul 2>&1 || (echo ERROR: PowerShell no disponible.& exit /b 1)

set "UX_BRANCH="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "UX_BRANCH=%%B"
if /I not "%UX_BRANCH%"=="ux-v42-experiencia" (
  echo ERROR: rama actual: "%UX_BRANCH%".
  echo Se requiere ux-v42-experiencia; no construir sobre main.
  exit /b 1
)

set "UX_DIRTY="
for /f "delims=" %%D in ('git status --porcelain 2^>nul') do set "UX_DIRTY=1"
if defined UX_DIRTY (
  echo ERROR: el arbol de trabajo tiene cambios sin confirmar.
  echo Guarda esos cambios, revisa git status y vuelve a ejecutar.
  git status --short
  exit /b 1
)

echo [1/3] Ejecutando todas las comprobaciones de V4.2 UX...
call "%~dp0PROBAR_UX_V42_WINDOWS.bat"
if errorlevel 1 (
  echo ERROR: QA no aprobado. No se empaqueta candidato.
  exit /b 1
)
echo.
echo [2/3] Compilacion y empaquetado local Electron...
echo Se generan Setup y Portable con la version del package.json.
echo IMPORTANTE: CREAR_EXE_WINDOWS.bat puede pausar la consola
echo y abrir la carpeta release al terminar.
echo NO EJECUTAR los instaladores resultantes sin el respaldo.
call "%~dp0CREAR_EXE_WINDOWS.bat"
if errorlevel 1 (
  echo ERROR: fallo el empaquetado de Windows.
  exit /b 1
)

echo.
echo [3/3] Comprobando artefactos y generando manifiesto SHA-256...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFICAR_CANDIDATO_UX_V42_WINDOWS.ps1"
if errorlevel 1 (
  echo ERROR: falta algun artefacto o la comprobacion fallo.
  exit /b 1
)
echo.
echo =========================================================
echo CANDIDATO DE ENSAYO GENERADO.
echo NO INSTALADO, NO PUBLICADO, NO FUSIONADO.
echo Falta QA visual, OBS real, respaldo y aprobacion de despliegue.
echo Revisa PLAN_LANZAMIENTO_UX_V42.md
echo =========================================================
exit /b 0
