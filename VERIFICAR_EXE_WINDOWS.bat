@echo off
cd /d "%~dp0"
echo Verificando codigo y empaquetado de OBS MASTER...
call npm run lint || goto :fail
call npm run test:core || goto :fail
call npm run build || goto :fail
call node_modules\.bin\tsc.cmd -p tsconfig.desktop.json || goto :fail
echo Validaciones correctas. La prueba de instalacion del EXE es independiente.
pause
exit /b 0
:fail
echo ERROR de validacion.
pause
exit /b 1
