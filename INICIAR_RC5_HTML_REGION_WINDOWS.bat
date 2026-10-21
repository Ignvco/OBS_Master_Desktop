@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ==============================================================
echo OBS MASTER RC5R - HTML REGION EXPERIMENTAL
echo 1920 CSS / captura ROI 720p PNG con alpha
echo ==============================================================
echo.
echo Solo fuera de emision publica. Primero detener Unity Camera y
echo salir completamente de OBS MASTER desde la bandeja.
echo Conservar OBS-Master-v5-monitor-async sin modificaciones.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: Falta entorno Python del laboratorio.
  goto :fail
)
echo [1/4] Pruebas Edge de fidelidad y benchmark ROI...
"%PYTHON_LAB%" "%CD%\desktop-app\lab\test_direct_html_roi.py"
if errorlevel 1 (
  echo ERROR: captura ROI no paso las pruebas. No iniciar motor.
  goto :fail
)
echo [2/4] Activando solo variables RC5R experimentales...
set "STDQ_DIRECT_HTML_ROI=1"
set "STDQ_DIRECT_HTML_CAPTURE=720"
set "STDQ_DIRECT_CAMERA_FOURCC=MJPG"
set "STDQ_DIRECT_MONITOR_FPS=15"
set "STDQ_DIRECT_MONITORS=1"
set "STDQ_DIRECT_DEBUG=1"
echo [3/4] Ejecutando pruebas RC5M de monitores y compilacion...
call "%~dp0INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat"
exit /b %ERRORLEVEL%

:fail
echo.
echo Regresar a RC5M si la prueba no es compatible con esta PC.
pause
exit /b 1
