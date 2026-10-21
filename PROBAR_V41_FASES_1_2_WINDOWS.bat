@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title OBS MASTER V4.1 - Fases 1 y 2

echo ==============================================================
echo  OBS MASTER 4.1 RC1 - ESTABILIDAD + CONTENT STUDIO
 echo ==============================================================
echo.
where npm >nul 2>&1 || (echo [ERROR] Node.js/npm no disponible.& goto :fail)
if not exist node_modules (echo [ERROR] Faltan dependencias. Ejecuta npm ci con acceso a Internet.& goto :fail)
if not exist desktop-app (echo [ERROR] Falta la carpeta desktop-app.& goto :fail)
echo [1/5] TypeScript del editor...
call npm run lint || goto :fail
echo [2/5] Suite completa, seguridad y backups...
call npm run test:core || goto :fail
echo [3/5] Generando editor y frontend...
call npm run build || goto :fail
echo [4/5] Compilando servidor independiente Electron...
call npm run desktop:server || goto :fail
echo [5/5] Copiando frontend a Electron...
if exist desktop-app\dist rmdir /s /q desktop-app\dist
xcopy /e /i /q dist desktop-app\dist >nul || goto :fail
echo.
echo [OK] Pruebas, frontend y servidor preparados.
echo Ahora abre OBS MASTER en Windows y completa la prueba privada.
echo Despues puedes generar el instalador usando CREAR_EXE_WINDOWS.bat.
echo Importante: esta prueba NO modifica .stdq-runtime ni los datos en AppData.
pause
exit /b 0
:fail
echo.
echo [FALLO] No empaquetes ni emitas hasta corregir el paso fallido.
echo Mantén disponible tu instalador V4.0 y el respaldo de AppData.
pause
exit /b 1
