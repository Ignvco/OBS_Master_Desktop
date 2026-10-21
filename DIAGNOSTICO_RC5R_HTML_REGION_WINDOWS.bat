@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo =========================================================
echo OBS MASTER RC5R - BENCHMARK HTML REGION (SIN UNITY)
echo Rama v5-html-roi, sin alterar version RC5M estable
echo =========================================================
echo.
echo Esta prueba NO requiere abrir OBS MASTER o usar la webcam.
echo Cierra cualquier otra prueba HTML si es posible.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: No se encuentra el Python validado.
  goto :fail
)
"%PYTHON_LAB%" -m py_compile "%~dp0desktop-app\lab\direct_html_roi.py" "%~dp0desktop-app\lab\direct_graphics.py" "%~dp0desktop-app\lab\test_direct_html_roi.py"
if errorlevel 1 goto :fail
echo.
echo Comparando capturas completas y recortadas con transparencia...
"%PYTHON_LAB%" "%~dp0desktop-app\lab\test_direct_html_roi.py"
if errorlevel 1 goto :fail
echo.
echo PRUEBA OFFLINE TERMINADA: copia RC5R_BENCH al chat.
pause
exit /b 0

:fail
echo.
echo PRUEBA RC5R NO APROBADA: NO usar modo ROI en emision.
pause
exit /b 1
