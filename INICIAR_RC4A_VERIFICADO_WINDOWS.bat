@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo.
echo ========================================================
echo  OBS MASTER V5 NATIVE - INICIO RC4A VERIFICADO (WINDOWS)
echo ========================================================
echo.
echo Antes de ejecutar: cerrar completamente OBS MASTER y Unity Camera.
echo No modifica ni elimina los datos de la instalacion v4.2.
echo.
where npm >nul 2>&1 || (echo ERROR: npm no esta disponible.& goto :fail)
where node >nul 2>&1 || (echo ERROR: Node.js no esta disponible.& goto :fail)
if not exist "src\components\spaces\BroadcastControlSpace.tsx" (echo ERROR: Ejecuta este BAT desde la raiz del repositorio.& goto :fail)

echo [0/6] Verificando que el puerto 3000 esta libre...
netstat -ano -p tcp | findstr /C:":3000" | findstr "LISTENING ESCUCHANDO" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo ERROR: Otro servidor ya ocupa el puerto 3000.
  echo Cierra OBS MASTER desde su icono en la bandeja, no solo la ventana.
  echo No cierres procesos forzosamente si StreamYard esta transmitiendo.
  echo.
  netstat -ano -p tcp | findstr /C:":3000"
  goto :fail
)

echo [1/6] Actualiza tu codigo manualmente con git pull origin v5-native antes de iniciar.
echo [2/6] Comprobacion de tipos...
call npm run lint
if errorlevel 1 goto :fail
echo [3/6] Pruebas...
call npm run test:core
if errorlevel 1 goto :fail
echo [4/6] Construyendo interfaz React...
call npm run build
if errorlevel 1 goto :fail
echo [5/6] Compilando servidor Electron...
call npm run desktop:server
if errorlevel 1 goto :fail

echo [6/6] Sincronizando interfaz compilada con Electron...
if not exist "dist\index.html" (echo ERROR: No existe dist\index.html& goto :fail)
robocopy "%CD%\dist" "%CD%\desktop-app\dist" /MIR /NFL /NDL /NJH /NJS /NC /NS
if errorlevel 8 (echo ERROR: Fallo la copia a desktop-app\dist& goto :fail)

echo.
echo Verificando marcador de nueva interfaz...
node -e "const fs=require('fs'),p=require('path');const d='desktop-app/dist/assets';if(!fs.existsSync(d))process.exit(2);const names=fs.readdirSync(d).filter(n=>n.endsWith('.js'));const ok=names.some(n=>fs.readFileSync(p.join(d,n),'utf8').includes('Preparar Preview'));if(!ok){console.error('ERROR: el build servido no contiene Preparar Preview. Verifica git pull y npm run build.');process.exit(3)}console.log('OK: Electron contiene Preparar Preview (RC4A)');"
if errorlevel 1 goto :fail

echo.
echo Arrancando ELECTRON DESDE ESTA RAMA...
cd /d "%~dp0desktop-app"
if not exist "node_modules\electron" (
  echo Instalando dependencias Electron...
  call npm ci
  if errorlevel 1 goto :fail
)
call npm start
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo RC4A NO INICIADO: revisa el error anterior.
pause
exit /b 1
