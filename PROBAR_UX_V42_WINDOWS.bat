@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo ======================================================
echo OBS MASTER V4.2 - UX ETAPA 1 / VALIDACION WINDOWS
echo Rama ux-v42-experiencia - NO ACTIVAR EN EMISION
echo ======================================================
echo.
echo Solo se ejecutan verificaciones automatizadas.
echo No se abre OBS Studio, StreamYard ni la camara virtual.
echo Hazlo sobre una copia aislada; respalda AppData antes de abrir la app.
if not exist "PROBAR_V42_WINDOWS.bat" (
 echo ERROR: falta PROBAR_V42_WINDOWS.bat.
 exit /b 1
)
call "%~dp0PROBAR_V42_WINDOWS.bat"
if errorlevel 1 (
 echo ERROR: la validacion tecnica fallo.
 exit /b 1
)
echo.
echo Tests aprobados. La verificacion visual y OBS real siguen PENDIENTES.
echo Consulta UX_V42_ETAPA1_IMPLEMENTACION.md.
exit /b 0
