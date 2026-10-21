@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ========================================================
echo   OBS MASTER 5 - RC5 HD 720p / MJPEG / UNITY CAMERA
echo   EXPERIMENTO v5-perf - NO MODIFICA v5-native
echo ========================================================
echo.
echo La webcam 0 entrego ~29.2 FPS reales en 1280x720
echo solicitando MJPG DESPUES de configurar la resolucion.
echo.
echo Requisitos:
echo   - Sal completamente de OBS MASTER desde la bandeja.
echo   - Deten Unity Camera y libera la webcam en otras apps.
echo   - Haz la prueba SIN emision publica.
echo.
echo Esta seleccion MJPEG solo se aplica al motor iniciado
echo en esta ventana CMD. No cambia la configuracion permanente.
echo.
set "STDQ_DIRECT_CAMERA_FOURCC=MJPG"
set "STDQ_DIRECT_MONITORS=1"
set "STDQ_DIRECT_DEBUG=1"
echo Formato solicitado: %STDQ_DIRECT_CAMERA_FOURCC% ^(DirectShow, ultimo^)
echo Monitores internos: ON
echo Registro de tiempos: ON
echo.
call "%~dp0INICIAR_RC5_PERF_WINDOWS.bat"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo Prueba RC5 MJPEG finalizada con error %RESULT%.
  echo Si no se inicio, revisa las lineas anteriores.
)
exit /b %RESULT%
