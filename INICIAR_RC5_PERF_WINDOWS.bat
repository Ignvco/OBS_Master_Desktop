@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ==================================================
echo  OBS MASTER 5 - RC5 PERFORMANCE DIAGNOSTIC
echo  Rama: v5-perf (no modifica main ni v5-native)
echo ==================================================
echo.
echo Cierra OBS MASTER y deten Unity Camera desde la bandeja.
echo.
set "PYTHON_LAB=%USERPROFILE%\Documents\OBS-MASTER-DIRECT-LAB\.venv312clean\Scripts\python.exe"
if not exist "%PYTHON_LAB%" (
  echo ERROR: No encuentro Python 3.12 en tu laboratorio validado.
  pause
  exit /b 1
)
echo [PERF] Validando equivalencia visual del compositor...
"%PYTHON_LAB%" "%CD%\desktop-app\lab\test_direct_perf.py"
if errorlevel 1 (
  echo ERROR: fallaron las pruebas de mezcla de color. NO arrancar.
  pause
  exit /b 1
)
echo.
echo [PERF] Habilitando telemetria. Datos cada 10 segundos.
set "STDQ_DIRECT_DEBUG=1"
if not defined STDQ_DIRECT_MONITORS set "STDQ_DIRECT_MONITORS=1"
echo [PERF] Monitores JPEG activos: %STDQ_DIRECT_MONITORS%
call "%~dp0INICIAR_RC4A_VERIFICADO_WINDOWS.bat"
exit /b %ERRORLEVEL%
