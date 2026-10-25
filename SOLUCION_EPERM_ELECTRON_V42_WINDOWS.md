# OBS MASTER V4.2 UX — Solución a EPERM al empaquetar Electron en Windows

**Incidente reportado en Windows:**

```text
EPERM: operation not permitted, rename
desktop-app\release\win-unpacked.tmp
  -> desktop-app\release\win-unpacked
```

El error se produce **durante la extracción de Electron en electron-builder**, antes de generar un instalador verificado. No demuestra fallo de React, TypeScript o los overlays. La causa raíz concreta debe verificarse en la máquina; una causa documentada es que VS Code/Cursor retiene un archivo `resources/default_app.asar` mediante el watcher. También puede existir un bloqueo por otra app, Explorer o protección de Windows.

Referencia de diagnóstico: https://github.com/microsoft/vscode/issues/308703
Guía oficial de solución de problemas: https://www.electron.build/v26/docs/

## Parche aplicado a la rama `ux-v42-experiencia`
- Nuevo `.vscode/settings.json`: excluye `desktop-app/release/**` del watcher del editor. Para soltar bloqueos ya existentes es preferible **cerrar completamente VS Code/Cursor** antes del primer reintento.
- Nuevo `LIMPIAR_STAGING_ELECTRON_UX_V42_WINDOWS.ps1`: elimina **únicamente** las carpetas regenerables `desktop-app/release/win-unpacked.tmp` y `desktop-app/release/win-unpacked`. Rechaza enlaces de tipo reparse point. Si el sistema mantiene archivos bloqueados, falla y orienta sin forzar procesos.
- `CREAR_EXE_WINDOWS.bat`: ejecuta esa limpieza inmediatamente antes de `npm run dist:win`; informa un EPERM con instrucciones.
- No se modifica `%APPDATA%\STDQ OBS Master`, la carpeta `.stdq-runtime`, las fuentes OBS, los comandos del motor ni los instaladores `Setup`/`Portable` preexistentes.

## Reintento recomendado

**No realizar mientras se está transmitiendo** ni con un EXE descomprimido de `win-unpacked` en uso.

1. Si hay alguna instancia abierta de OBS MASTER de ensayo, ciérrala completamente (incluida su bandeja de sistema). No es necesario cerrar OBS Studio, siempre que no esté usando un archivo de este directorio.
2. En una consola CMD fuera de VS Code/Cursor:

```bat
cd /d "C:\Users\Si Te Dijera Que\Desktop\OBS-Master-v42-UX"
git status --short
git pull --ff-only origin ux-v42-experiencia
```

**Si `git status --short` muestra cambios locales**, respaldarlos/revisarlos antes de hacer pull; no ejecutar `git reset --hard`, `git clean -fd` ni borrar dependencias o AppData.

3. **Cerrar completamente VS Code y Cursor**, también las ventanas de Explorador de archivos posicionadas en `desktop-app/release`. Utilizar CMD normal.
4. Ejecutar el empaquetado controlado, incluidas las pruebas y el manifiesto:

```bat
PREPARAR_CANDIDATO_UX_V42_WINDOWS.bat
```

El procedimiento principal ejecuta `PROBAR_UX_V42_WINDOWS.bat`, el empaquetado y el verificador SHA-256.

## Reintento rápido solo si [1/6]–[5/6] del build anterior estaban realmente aprobadas

Desde CMD externo, luego del `git pull`, cerrar editores y Explorer:
```bat
powershell -NoProfile -ExecutionPolicy Bypass -File ".\LIMPIAR_STAGING_ELECTRON_UX_V42_WINDOWS.ps1"
cd desktop-app
npm run dist:win
```

**Importante:** el reintento rápido omite repetir las comprobaciones; se reserva a quien ya comprobó sus resultados. Si genera ambos `.exe`, regresar a la raíz y ejecutar el verificador, y efectuar el QA completo antes de instalar. La ruta principal anterior es la recomendada.

## Si continúa EPERM

1. Confirmar que `Code.exe`, `Cursor.exe`, una instancia Electron, la carpeta `win-unpacked` o una ventana de Explorer no estén usando la salida. Un reinicio de Windows puede liberar bloqueos persistentes.
2. Revisar **Seguridad de Windows → Protección contra virus y amenazas → Historial de protección** y, si está activo, el acceso controlado a carpetas. Conceder acceso únicamente a una herramienta de confianza si hay evidencia de bloqueo: **no desactivar Microsoft Defender de forma global**.
3. Si la carpeta Desktop está bajo vigilancia activa de aplicaciones o antivirus, trabajar en un clon limpio en `C:\dev\OBS-Master-v42-UX` u otra carpeta de desarrollo fuera del Escritorio. El EXE conserva los mismos datos AppData: no usarlo para una instalación de ensayo sin aislamiento de usuario/VM.
4. Si el nuevo log vuelve a fallar, recoger el fragmento del error desde `npm run dist:win`, la carpeta afectada y si VS Code/Cursor/Defender estaban activos. No enviar credenciales ni copiar AppData al chat.

## Verificación final
- `desktop-app/release/STDQ-OBS-MASTER-Setup-4.2.0-rc.1.exe`
- `desktop-app/release/STDQ-OBS-MASTER-Portable-4.2.0-rc.1.exe`
- `desktop-app/release/MANIFIESTO-SHA256-UX-V42.txt`

No asumir que existen hasta que el script termine exitosamente. El manifiesto SHA-256 verifica integridad de artefactos, **no certifica su ejecución**. Seguir `PLAN_LANZAMIENTO_UX_V42.md` para pruebas en usuario Windows aislado, backups, OBS y StreamYard, y mantener PR #8 DRAFT.

**Estado:** fix subido a GitHub. Validación del arreglo en Windows real pendiente de nueva ejecución; no se ejecutaron GitHub Actions.
