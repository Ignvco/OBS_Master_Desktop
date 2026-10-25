# OBS MASTER V4.2 UX — PLAN OFICIAL DE CIERRE Y LANZAMIENTO

**Proyecto:** Si Te Dijera Que? — OBS MASTER Desktop
**Fecha de apertura:** 2026-10-24
**Rama candidata:** `ux-v42-experiencia` (PR #8, DRAFT)
**Rama estable protegida:** `main`
**Rama experimental excluida:** `v5-monitor-async`
**Entorno:** Windows x64, OBS Studio/OBS WebSocket v5, OBS Virtual Camera, StreamYard externo.
**Estado del programa:** Dirección UX aprobada por el usuario; validación técnica de Windows y prueba real OBS todavía pendientes.

**Incidente de empaquetado Windows (EPERM):** si `electron-builder` falla al renombrar `win-unpacked.tmp` a `win-unpacked`, no instalar un candidato incompleto. Consultar [SOLUCION_EPERM_ELECTRON_V42_WINDOWS.md](SOLUCION_EPERM_ELECTRON_V42_WINDOWS.md), cerrar editores que puedan bloquear ASAR y actualizar la rama UX. La preparación ahora ejecuta `LIMPIAR_STAGING_ELECTRON_UX_V42_WINDOWS.ps1` antes de empaquetar, sin borrar instaladores ni AppData.

## 1. Política de lanzamiento (sin GitHub Actions)

No requiere pagar GitHub Actions. Todo ocurre en la computadora Windows:
- `PROBAR_UX_V42_WINDOWS.bat`: TypeScript, `test:core` (incluye contratos UX), compilación servidor y Vite; guarda registro en `%TEMP%\OBS_MASTER_V42_UX_QA.log`.
- `PREPARAR_CANDIDATO_UX_V42_WINDOWS.bat`: comprueba rama, exige árbol limpio, llama al validador, empaqueta con `CREAR_EXE_WINDOWS.bat` y verifica ambos `.exe`. **Nunca instala ni publica.**
- `VERIFICAR_CANDIDATO_UX_V42_WINDOWS.ps1`: coteja versiones y comprueba Setup y Portable con SHA-256, generando un manifiesto.
- `RESPALDAR_V42_PRE_LANZAMIENTO_WINDOWS.ps1`: respaldo opt-in de AppData de producción después de cerrar OBS MASTER completamente; verifica archivos y hashes críticos, sin borrar los originales.

No usar GitHub Actions, no activar auto-release ni fusionar antes de los gates definidos a continuación.

## 2. Hallazgo crítico de compatibilidad / no ejecutar en producción aún

La aplicación usa:
- `desktop-app/package.json`: versión actual **4.2.0-rc.1** tanto para NSIS Setup como Portable.
- `desktop-app/main.cjs`: carpeta **`%APPDATA%\STDQ OBS Master`**, incluyendo `.stdq-runtime` (estación, catálogo y multimedia); `appId` **`cl.sitedijeraque.obsmaster`**; servidor local puerto **3000**.
- Las fuentes existentes de OBS dependen de `http://localhost:3000/?overlay=...`; esta dirección debe seguir funcionando después de actualizar.

**Una copia de código en otra carpeta NO aísla los datos de un EXE Electron**, porque comparten el mismo perfil de Windows. Tampoco se pueden ejecutar ambas estaciones simultáneamente: compiten por el puerto 3000. Para probar el EXE sin tocar los datos reales, usar **una VM o un usuario de Windows de ensayo independiente**. El acceso vía `INICIAR_WINDOWS.bat` inicia Vite desarrollo y no equivale a ejecutar el instalador Electron.

No instalar un Setup UX con idéntico nombre, versión o appId sobre el OBS MASTER estable sin copia comprobada y plan de reversión. Antes de distribución final, coordinar el número de versión y lockfiles raíz/desktop-app para distinguir inequívocamente la entrega.

## 3. Gates de lanzamiento

| Gate | Condición | Estado actual |
|---|---|---|
| G0 · UX aprobado | Usuario aprueba distribución, inspector y realización | APROBADO |
| G1 · Revisión estructural | Comparación con `main`, sin cambio del motor OBS | REVISADO ESTÁTICAMENTE |
| G2 · QA automático Windows | Lint, core tests, servidor Electron, build | PENDIENTE |
| G3 · Setup + Portable | Ambos EXE generados, versión coherente, hashes SHA-256 | PENDIENTE |
| G4 · Respaldo y ensayo aislado | Copia AppData verificada y prueba en usuario/VM independiente | PENDIENTE |
| G5 · Operación OBS real | Preview/Program, Browser Sources, salida y emergencia | PENDIENTE |
| G6 · StreamYard / audio | Cámara OBS visible, audio externo verificado; sin emisión pública | PENDIENTE |
| G7 · Revisión Director Técnico | Flujo completo usable sin asistencia, incluyendo rollback | PENDIENTE |
| G8 · Promoción y distribución | Versión definitiva, merge `main`, entrega controlada | BLOQUEADO |

**Regla:** ninguna fase pendiente se da por aprobada solo por capturas, compilaciones antiguas o un PR abierto.

## 4. Crear el candidato Windows sin modificar producción

Requisitos: Git for Windows, Node.js 22 LTS, npm, PowerShell, conexión para instalar dependencias, Windows x64, un clon en la rama de ensayo.

```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v42-UX"
git status --short
git pull --ff-only origin ux-v42-experiencia

PREPARAR_CANDIDATO_UX_V42_WINDOWS.bat
```

**Antes del pull:** si hay archivos modificados localmente, resguardarlos. `PREPARAR_CANDIDATO...` se niega a continuar si no estás en la rama UX o si hay cambios en seguimiento. El script de empaquetado existente abre la carpeta release y pausa para una tecla; deja que termine y no instales inmediatamente.

Artefactos esperados (según versión actual de `desktop-app/package.json`):
- `desktop-app\release\STDQ-OBS-MASTER-Setup-4.2.0-rc.1.exe`
- `desktop-app\release\STDQ-OBS-MASTER-Portable-4.2.0-rc.1.exe`
- `desktop-app\release\MANIFIESTO-SHA256-UX-V42.txt`

Los nombres de versión anteriores son **los del metadata actual**, no un anuncio de versión final. Los hashes detectan modificaciones accidentales: **no reemplazan firma digital ni resuelven las advertencias de SmartScreen**.

## 5. Copia de seguridad local de datos operativos

**Solo fuera de transmisión y después de salir completamente de OBS MASTER, también desde bandeja.**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\RESPALDAR_V42_PRE_LANZAMIENTO_WINDOWS.ps1"
```

El script pide escribir `RESPALDAR` y copia `%APPDATA%\STDQ OBS Master` a Documentos, generando un comprobante. No elimina AppData, no restaura datos y nunca sube archivos a GitHub.

En ejecución por `INICIAR_WINDOWS.bat` puede existir también `.stdq-runtime` dentro de la carpeta de desarrollo; si se está utilizando ese modo, crear una copia privada adicional de ese directorio. El respaldo Electron no sustituye el respaldo de Vite.

Conservar la versión estable anterior (instalador o portable validado) junto al respaldo y su ubicación. **No compartir logs que contengan secretos, contraseñas OBS, direcciones locales ni datos privados.**

## 6. Prueba del EXE en ambiente aislado

**Preferencia:** usuario Windows de ensayo distinto o máquina virtual. El clon de Git, por sí solo, no aísla el userData de Electron.
1. Cerrar todas las estaciones activas y verificar que no haya un servidor antiguo ocupando el puerto 3000.
2. En el usuario/VM de ensayo, instalar o ejecutar el **Portable** y confirmar inicio sin consola, Vite ni Node externo.
3. Comprobar persistencia de gráfico, episodio, biblioteca y recursos después de reiniciar. No usar datos reales sin respaldo.
4. Probar snapshots, Guardar versión, Recuperar solo al borrador y Publicar diseño; publicación no debe mostrar una Browser Source.
5. Con OBS de prueba: fuentes Browser URL correctas, escenas y Modo Estudio, transición y Program, Motion y despejar gráficas.
6. Simular fuente ausente/ambigua y comprobar bloqueo y reparación; no permitir activar webcam por error.
7. Iniciar cámara virtual y validar recepción en StreamYard **sin iniciar una emisión pública**. La mezcla de audio externa debe comprobarse por separado.
8. Comprobar bandeja, servidor activo, salida completa y liberación del puerto.
9. Probar 1366×768, 1280×720 y 1920×1080, teclado y escalado Windows 125%/150%.
10. Repetir prueba de instalación/desinstalación/reinstalación en entorno aislado y confirmar preservación de datos.

## 7. Plan de reversión si la actualización falla

El objetivo es que **el directo nunca dependa de una actualización sin ensayar**.

- Antes del corte, conservar el EXE anterior, el respaldo validado de AppData y una copia del perfil operativo OBS.
- Si el candidato presenta falla, **no transmitir desde él**: salir completamente; verificar que libera el puerto 3000.
- En ventana de mantenimiento, reinstalar o ejecutar la versión anterior ya comprobada.
- Si los datos quedaron alterados, **NO hacer restauración automática mientras esté la app abierta**. Guardar por separado la carpeta de datos nueva, y restaurar manualmente la copia validada a su ubicación original (nunca borrar el único respaldo).
- Revalidar lectura de biblioteca, escenas y gráficas en OBS de ensayo antes de retornar al programa.
- Documentar qué falló, cómo volver a reproducirlo y qué comportamiento confirma la recuperación.

**No se implementa un rollback automático destructivo.** La restauración final debe ser deliberada y realizada por el operador.

## 8. Criterios para autorizar el lanzamiento

Registrar el resultado del QA automático y la prueba operativa en `UX_V42_CONSOLIDACION_QA.md`. Después:
1. Asignar identificador de versión final distinto de la actual RC y sincronizar ambos `package.json` y lockfiles de forma reproducible.
2. Repetir pruebas y empaquetado con esa versión, generar nuevo hash y validar ambos artefactos.
3. Obtener aprobación final de uso operativo y decisión explícita de merge.
4. Fusionar PR #8 a `main` solamente entonces; no cambiar `v5-monitor-async`.
5. Conservar paquetes Setup + Portable, manifiesto SHA-256, notas de versión, respaldo y comprobante de ensayo como kit interno.
6. Hacer despliegue **en una ventana sin transmisión**, con un plan de regresión corto y vuelta atrás disponible.

## 9. Tareas y responsables

| Responsabilidad | Quién |
|---|---|
| UX/UI y revisión de código | ChatGPT + usuario |
| Ejecutar .bat/.ps1, recopilar log | Operador de Windows |
| Ensayar OBS, Broadcast Sources, StreamYard | Director Técnico / operador |
| Verificar respaldo y recuperación | Responsable de estación |
| Aprobar instalación final y merge | Usuario |

## 10. Estado inmediato

**FASE DE PREPARACIÓN INICIADA, NO LANZAMIENTO EJECUTADO.**

Se entregan scripts y guía en la rama experimental. **Ningún EXE se generó en esta sesión** y ningún test Windows real fue ejecutado aquí. GitHub Actions no es necesario ni se ha ejecutado. `main` sigue protegido. PR #8 permanece como borrador.
