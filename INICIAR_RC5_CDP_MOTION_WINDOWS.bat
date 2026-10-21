@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ==============================================================
echo  OBS MASTER RC5C - CDP HTML MOTION (EXPERIMENTO PROTEGIDO)
echo  Rama v5-html-cdp. RC5M y RC5H NO se modifican.
echo ==============================================================
echo.
echo Cierra OBS MASTER completamente desde la bandeja y detén Unity.
echo Prueba fuera de emision publica. Conserva tus clones RC5M/RC5H.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: No encuentro el entorno Python validado del laboratorio.
  goto :fail
)
echo [1/4] Verificando codigo nuevo...
"%PYTHON_LAB%" -m py_compile "%~dp0desktop-app\lab\direct_html_capture.py" "%~dp0desktop-app\lab\direct_graphics.py" "%~dp0desktop-app\lab\test_direct_html_cdp.py"
if errorlevel 1 goto :fail
echo [2/4] COMPARACION Edge: transparencia + ticker Playwright vs CDP...
"%PYTHON_LAB%" "%~dp0desktop-app\lab\test_direct_html_cdp.py"
if errorlevel 1 (
  echo ERROR: Edge/CDP NO paso test de alfa, dimensiones o cinta.
  echo Por seguridad, NO iniciamos Unity Camera con este motor.
  goto :fail
)
echo [3/4] Activando CDP y configuracion RC5M HD comprobada...
set "STDQ_DIRECT_HTML_ENGINE=cdp"
set "STDQ_DIRECT_HTML_CAPTURE=720"
set "STDQ_DIRECT_CAMERA_FOURCC=MJPG"
set "STDQ_DIRECT_MONITOR_FPS=15"
set "STDQ_DIRECT_MONITORS=1"
set "STDQ_DIRECT_DEBUG=1"
echo [4/4] Inicio RC5H con verificaciones previas y Electron...
call "%~dp0INICIAR_RC5_HTML_MOTION_WINDOWS.bat"
exit /b %ERRORLEVEL%

:fail
echo.
echo PRUEBA DETENIDA. Usa RC5M (v5-monitor-async) como respaldo.
pause
exit /b 1
