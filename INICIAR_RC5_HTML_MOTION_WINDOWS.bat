@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ==============================================================
echo  OBS MASTER RC5H - HTML MOTION / CAPTURA HD EXPERIMENTAL
echo  Rama v5-html-motion - no toca v5-monitor-async estable
echo ==============================================================
echo.
echo Cierra OBS MASTER totalmente desde la bandeja y detén Unity.
echo No ejecutar durante una transmisión publica.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: Python validado del laboratorio no encontrado.
  goto :fail
)
echo [1/4] Comprobando sintaxis Python de la captura HTML...
"%PYTHON_LAB%" -m py_compile "%CD%\desktop-app\lab\direct_graphics.py" "%CD%\desktop-app\lab\test_direct_html_capture.py"
if errorlevel 1 goto :fail
echo [2/4] Comprobando escala, transparencia, dimensiones y Playwright Edge...
"%PYTHON_LAB%" "%CD%\desktop-app\lab\test_direct_html_capture.py"
if errorlevel 1 goto :fail
echo [3/4] Activando únicamente el nuevo modo HTML...
set "STDQ_DIRECT_HTML_CAPTURE=720"
set "STDQ_DIRECT_CAMERA_FOURCC=MJPG"
set "STDQ_DIRECT_MONITOR_FPS=15"
set "STDQ_DIRECT_MONITORS=1"
set "STDQ_DIRECT_DEBUG=1"
echo Modo grafico: 1920 CSS / PNG alpha 1280x720
echo Camara Unity: 1280x720 MJPG / 30 FPS objetivo
echo Monitores: 640x360 / 15 FPS objetivo
echo.
echo [4/4] Validaciones completas e inicio Electron...
call "%~dp0INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat"
exit /b %ERRORLEVEL%

:fail
echo.
echo RC5H NO INICIADO: conservar RC5M anterior y compartir el error.
pause
exit /b 1
