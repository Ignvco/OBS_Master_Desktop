@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo =============================================================
echo OBS MASTER 5 - RC5 HD + MONITORES ASINCRONOS EXPERIMENTALES
echo Rama aislada: v5-monitor-async
echo =============================================================
echo.
echo Cierra OBS MASTER completamente desde la bandeja.
echo Deten Unity Camera y libera la webcam en otras aplicaciones.
echo NO ejecutar durante una transmision publica.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: no encontre el entorno Python del laboratorio.
  goto :fail
)
echo [1/3] Validando sintaxis de codificadores de monitor...
"%PYTHON_LAB%" -m py_compile "%~dp0desktop-app\lab\direct_monitor_encoder.py" "%~dp0desktop-app\lab\test_direct_monitor_encoder.py"
if errorlevel 1 goto :fail
echo [2/3] Validando monitores independientes y descarte de frames atrasados...
"%PYTHON_LAB%" "%~dp0desktop-app\lab\test_direct_monitor_encoder.py"
if errorlevel 1 goto :fail
echo [3/3] Arrancando MJPEG HD y monitor dual async...
set "STDQ_DIRECT_MONITOR_FPS=15"
set "STDQ_DIRECT_MONITORS=1"
set "STDQ_DIRECT_CAMERA_FOURCC=MJPG"
set "STDQ_DIRECT_DEBUG=1"
echo.
echo Unity Camera: 1280x720 / objetivo 30fps
echo Monitores: 640x360 / objetivo 15fps por monitor
echo El monitor interno NO se envia a StreamYard.
echo.
call "%~dp0INICIAR_RC5_HD_MJPG_WINDOWS.bat"
exit /b %ERRORLEVEL%

:fail
echo.
echo RC5 monitores NO INICIADO: revisa las pruebas anteriores.
pause
exit /b 1
