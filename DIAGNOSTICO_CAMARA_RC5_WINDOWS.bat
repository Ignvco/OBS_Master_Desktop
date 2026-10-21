@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo =====================================================
echo  OBS MASTER - DIAGNOSTICO CAMARA FISICA (RC5)
echo  NO NECESITA OBS MASTER, UNITY NI STREAMYARD
echo =====================================================
echo.
echo IMPORTANTE: DETEN Unity Camera y SAL COMPLETAMENTE
echo de OBS MASTER desde la bandeja antes de continuar.
echo Otros programas (Edge, StreamYard, OBS) no deben usar
echo la misma webcam durante esta prueba.
echo.
pause
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: falta el Python del laboratorio validado:
  echo %PYTHON_LAB%
  pause
  exit /b 1
)
"%PYTHON_LAB%" -m py_compile "%~dp0desktop-app\lab\camera_benchmark_rc5.py"
if errorlevel 1 (
  echo ERROR: benchmark no compila.
  pause
  exit /b 1
)
echo.
echo Midiendo 720p DEFAULT/MJPG-first/MJPG-last/YUY2-last,
echo resoluciones 960x540 y 640x360, control 640x480 y Windows MSMF.
echo Solo cambia parametros temporales de apertura de webcam.
echo No graba imagenes, audio ni video.
echo.
"%PYTHON_LAB%" "%~dp0desktop-app\lab\camera_benchmark_rc5.py" --camera 0
set "RESULT=%ERRORLEVEL%"
echo.
echo ==============================================
echo Si hay resultados, copialos al chat. 
echo ==============================================
pause
exit /b %RESULT%
