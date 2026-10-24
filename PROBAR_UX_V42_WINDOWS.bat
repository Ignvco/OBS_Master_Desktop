@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo ======================================================
echo OBS MASTER V4.2 - CONSOLIDACION UX ETAPAS 1-5
echo Rama ux-v42-experiencia - NO UTILIZAR EN EMISION
echo ======================================================
echo.
echo Este proceso verifica TypeScript, tests, servidor y build.
echo No abre OBS Studio, StreamYard ni la camara virtual.
echo Ejecuta en un clon separado y resguarda AppData antes de abrir la app.
echo.

where node >nul 2>&1 || (echo ERROR: falta Node.js.& exit /b 1)
where npm >nul 2>&1 || (echo ERROR: falta npm.& exit /b 1)
if not exist "PROBAR_V42_WINDOWS.bat" (
 echo ERROR: falta PROBAR_V42_WINDOWS.bat.
 exit /b 1
)

set "UX_QA_LOG=%TEMP%\OBS_MASTER_V42_UX_QA.log"
echo Guardando registro tecnico en: "%UX_QA_LOG%"
echo.
call "%~dp0PROBAR_V42_WINDOWS.bat" > "%UX_QA_LOG%" 2>&1
set "UX_QA_EXIT=%ERRORLEVEL%"
type "%UX_QA_LOG%"
echo.
if not "%UX_QA_EXIT%"=="0" (
 echo ERROR: una o mas verificaciones fallaron. NO usar en produccion ni fusionar.
 echo Comparte el registro "%UX_QA_LOG%" para revisar el fallo.
 exit /b %UX_QA_EXIT%
)

echo Validaciones automatizadas finalizadas con codigo 0.
echo AUN FALTAN pruebas visuales Windows, OBS real, Browser Sources y StreamYard de ensayo.
echo Lee UX_V42_CONSOLIDACION_QA.md. Mantener PR #8 en borrador.
echo Registro: "%UX_QA_LOG%"
exit /b 0
