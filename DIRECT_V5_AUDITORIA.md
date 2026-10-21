# OBS MASTER 5.0 — Auditoría y plan de migración nativa

**Estado:** auditoría estática del código en `main`. **NO es una integración final ni un test en Windows.**
**Fecha:** 2026-10-21. **Base estable:** v4.2 RC1.

## Decisión del producto

**Una sola interfaz En Vivo. Una sola salida de video. Sin OBS Studio ni OBS WebSocket en operación.**

El objetivo es **sustituir las dependencias en la experiencia existente**, no introducir una pestaña/direct mode separado. La rama de experimento `v5-direct` creó `DirectControlSpace` y un selector OBS/Direct; **ese enfoque ha sido rechazado** y **no se llevará a `main`**.

## Auditoría del código actual

| Módulo | Confirmación | Migración requerida |
| --- | --- | --- |
| `src/App.tsx` | Estado global, handlers En Vivo, publicación y Motion; `obsService` controla cámara, escenas, preview/program y fuentes | Sustituir handlers de OBS por interfaz nativa de motor de salida; mantener props/flujo del panel |
| `src/components/spaces/BroadcastControlSpace.tsx` | Panel En Vivo existente; depende de escenas/transiciones/fuentes OBS | **Reutilizar la UI**, adaptar el modelo subyacente a escenas propias y preview/program reales |
| `src/components/spaces/OBSSettingsTab.tsx` | Controles OBS WebSocket, servidor/puerto, telemetría | Sustituir **en la misma sección** por entrada física, formato, resolución, FPS y estado de Unity Capture |
| `src/services/obsWebSocket.ts` | OBS RPC, comandos, status y reconexión | Retirar de la ruta operativa solo tras paridad funcional probada |
| `src/components/overlays/BroadcastOverlayRenderer.tsx` | Render HTML de una gráfica publicada; posicionamiento en espacio fijo **1920 × 1080**, Motion y escucha SSE | Reutilizar renderer con compositor Direct; soportar simultaneidad/orden de capas, preview y program |
| `src/server/stationBridge.ts` y `src/services/sharedStation.ts` | Estado persistente, SSE, API de publicación | Reusar la sincronización y proteger escritura/commit de program |
| `src/utils/publicationEngine.ts` | Borrador ≠ publicado; `visibleInOBS` bloquea publicar si está visible; publicar NO crea revisiones | Conservar semántica sin OBS: mantener bloqueo real según salida; definir estado visible/pendiente y migración compatible |
| `desktop-app/main.cjs` | Punto de entrada Electron, servidor local, bandeja y cierre | Administrar proceso de video, señales de salida, IPC/control, reinicio seguro y terminación completa |
| `src/types/index.ts` | Tipos `OBSStatus`, `OBSScene` y persistencia editorial | Modelo de producción independiente del proveedor, con migración no destructiva |

### Hallazgo crítico — Preview y Al Aire

El código de `BroadcastControlSpace.tsx` describe explícitamente las vistas como **esquemáticas**, sin imagen real ("Vista esquemática de Program, no video real"). Al migrar, **no basta con renombrar estados**: Preview y Al Aire deben mostrar **frames del compositor real**. Se conservará **el diseño del panel actual**, elevando estas superficies a señal verdadera.

### Hallazgo crítico — contenido y versiones

`applyPublication()` protege las gráficas `visibleInOBS`; la UI también consulta fuentes activas OBS para impedir cambios al aire. Es una salvaguarda correcta pero hoy acoplada a OBS. Debe migrarse a un estado confirmado por el motor Direct, **sin anularla**. `saveRevision()` es voluntaria; ni publicar ni replay crean revisiones.

### Hallazgo crítico — Unity Capture todavía NO está en el repositorio

La prueba validada de Windows consiste en un `direct_graphics.py` externo, con Python 3.12 / Playwright / OpenCV / pyvirtualcam y el filtro Unity Capture. La rama `main` no contiene ese script ni un supervisor Electron integrado. Se requiere **incorporar el código real del laboratorio**, no recrearlo a ciegas.

El laboratorio renderiza actualmente una URL de overlay y necesita viewport HTML **1920 × 1080** aunque la salida experimental sea **1280 × 720 / 30 FPS**. Deben probarse múltiples gráficos y composición de escenas antes de una emisión real.

### Error al apagar — Playwright

Traceback reportado por el usuario:
`direct_graphics.py:158 → browser.close() → Error: Event loop is closed! Is Playwright already stopped?`.

Diagnóstico: llamada a Playwright tras cierre de su runtime asíncrono/síncrono; **probable orden de cleanup incorrecto**. Sin fuente completa del script, no afirmar ubicación exacta del `with sync_playwright()`. Corregir el ciclo de vida, cerrar contexto/browser **dentro del ámbito vivo de Playwright**, bloquear nuevas capturas y esperar threads con timeouts. Cerrar Unity Capture y liberar la webcam después; comprobar residuos `msedge` solo del proceso hijo. Añadir prueba de 20 ciclos start/stop y finalización sin tracebacks.

## Arquitectura meta

Cámara física → **Capture Service** → **Scene Compositor** (Preview independiente / Program) → **Unity Capture Virtual Camera** → StreamYard.

- **Panel En Vivo existente** → Production Controller (comandos `prepare`, `take`, `show`, `hide`, `transition`, `motionReplay`, `panic`)
- **Content Studio existente** → Draft / explicit Publish / historial existente
- **Configuración existente** → selección física real, formatos soportados, FPS, resolución, estado de salida
- **Electron main** → ciclo de vida de proceso video, IPC autenticado de origen local, gestión de cierres
- **Direct runtime** → medición efectiva de FPS, frames, errores, preview/program y ACK de comandos; evitar confirmar StreamYard basándose solo en flags internos

**No mostrar simulaciones como señal real**. La cámara virtual es **destino de video**, no sustituto de un protocolo de control; la orquestación la desarrolla OBS MASTER.

## Fases y condiciones de paso

1. **Paridad funcional**: inventario completo de controles `BroadcastControlSpace`, `Header`, `MissionControlSpace`, `PreflightRundownSpace`, `OBSSettingsTab` y de las rutas `App.tsx`; matriz de pruebas.
2. **Importación del laboratorio**: incorporar el **`direct_graphics.py` original** y limpiar orden de cierre; permitir Windows/Unity Capture como salida; salud y recuperación.
3. **Compositor**: captura física + gráficos HTML transparentes, varias capas, motion y señal real; estados separados Preview / Program.
4. **Integración de control**: adaptar los handlers de App y el Panel En Vivo **existente**, sin crear nueva pantalla; publicación segura con ACK de la salida.
5. **Configuración**: sustituir sección OBS WebSocket en su ubicación actual; detectar formatos soportados y guardar la selección.
6. **Eliminación OBS**: retirar servicios/campos obsoletos después de pasar pruebas, con migración reversible de datos.
7. **Validación Windows 10**: lint, tests, build, instalador, fuente EMEET, desconexiones, overlays concurrentes, 30/60 FPS según soporte, 20 ciclos arranque/apagado, y transmisión prolongada hacia StreamYard.

## Invariantes

- `main` v4.2 no se modifica antes de aprobar v5.
- No nuevo Panel En Vivo ni selector de motores.
- No pérdida ni reinterpretación visual de diseños de Content Studio.
- Preview nunca modifica Al Aire hasta acción confirmada.
- Borrador y publicado independientes; restaurar no publica; publicar no crea historial.
- Resolución y FPS **reales**, no valores simulados.
- El cierre completo elimina procesos hijos sin detener software Edge ajeno al proyecto.

## Material pendiente para implementación correcta

1. `direct_graphics.py` real del equipo Windows (versión con viewport 1920×1080), idealmente el laboratorio completo salvo venv y archivos privados.
2. Validación local en Windows con EMEET, Unity Capture y StreamYard.
3. Decisiones técnicas para compositor de múltiples overlays y frames Preview/Program, tras medir consumo del laboratorio.

**No se afirma que el motor esté integrado ni que las pruebas de Windows hayan pasado**. Esta fase documenta el estado y bloqueos reales.


## Implementación incremental — Motor supervisado RC1 (2026-10-21)

**Cambios aplicados**

- `lab/direct_graphics.py`: acepta orden `STOP` por stdin. Mantiene Unity Capture y cleanup de Playwright dentro del contexto original; de momento capta una página HTML.
- `desktop-app/lab/direct_graphics.py`: copia para empaquetado, sincronizada con el motor de laboratorio.
- `desktop-app/direct-process.cjs`: inicia el proceso Python sin shell, captura stdout/stderr, evita dos instancias, envía STOP y espera hasta 35 segundos.
- `desktop-app/main.cjs`: crea supervisor y agrega comandos **temporales al menú de bandeja**; al salir solicita detención. No crea pestañas ni duplica Panel En Vivo.
- `desktop-app/package.json`: incluye supervisor y ubica script fuera de app.asar mediante `extraResources`.

**Límites y riesgos**

- Esto es **el primer hito de ciclo de vida**, NO una migración lista para emitir. La UI actual todavía tiene `obsWebSocket` y la salida no se conecta a la vista Preview/Program ni al catálogo de fuentes.
- Se requiere el Python 3.12 `.venv312clean` validado en `Documents/OBS-MASTER-DIRECT-LAB`; el ejecutable Python y las dependencias NO están empaquetados.
- Durante la prueba, el nombre de dispositivo en StreamYard sigue siendo **Unity Video Capture**, no OBS MASTER Camera.
- Si el cierre no responde antes del timeout, la aplicación informa un error. **No matar forzosamente** el proceso por defecto para evitar dejar componentes sin limpieza.
- No fue posible ejecutar tests de Windows/Node o un instalador en este entorno. Validar localmente antes de usar en producción.

**Prueba manual del primer hito en Windows**

1. Mantener la app v4.2 instalada separada. Respaldar AppData y la carpeta de Direct Lab.
2. Crear clon limpio `git clone --branch v5-native --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-native`.
3. En la raíz: `npm ci`, `npm run lint`, `npm run test:core`, `npm run build`, `npm run desktop:server`.
4. En `desktop-app`: `npm ci`; `npm start` (usa los artefactos generados de la compilación; si `dist` o `compiled` faltan, replicar el staging del `CREAR_EXE_WINDOWS.bat`).
5. Cerrar el `direct_graphics.py` externo previamente: solo debe haber una salida Unity Capture activa.
6. Desde el **ícono de bandeja de OBS MASTER**, usar `Iniciar Unity Camera (laboratorio)`. Abrir StreamYard, seleccionar `Unity Video Capture`, comprobar la señal y lower third.
7. Desde la misma bandeja usar `Detener Unity Camera`; verificar que se libera webcam y no aparece el error de Playwright.
8. Repetir al menos 5 veces, incluida salida de Electron mientras la cámara está encendida. Ejecutar 20 ciclos antes de declarar estabilidad.

**Siguiente hito obligatorio**: integración del Production Controller, composición de escenas múltiple, monitores reales Preview/Program, comandos del Panel En Vivo existente, configuración real de entrada/salida y retirada definitiva de OBS WebSocket. No reemplazar simulaciones por estados meramente declarativos.


## Implementación incremental — Compositor Program multi-gráfica RC2 (2026-10-21)

**Cambios de código**

- `src/components/overlays/DirectCompositeRenderer.tsx`: una página transparente **1920 × 1080** reutiliza `GraphicComponentRenderer`, `useLayerTimeline`, `BrandLogoLayer` y Motion para pintar simultáneamente gráficos publicados visibles; una sola suscripción SSE.
- `src/utils/directComposition.ts`: selector determinista que **solo recibe registros publicados**; sin borradores, preserva `animationReplay` y agrega personalizados.
- `src/App.tsx`: ruta especial `/?overlay=direct-program` antes de las páginas legacy.
- `desktop-app/main.cjs` y `direct-process.cjs`: el motor Unity Capture ahora captura `/?overlay=direct-program`, no solo `lower-third`.
- `desktop-app/server.ts`: `GET /api/direct/status` obtiene el estado **real del supervisor**, solo lectura, host local y verificación de Origin; sin fingir entrega de frames a StreamYard.
- `src/tests/directComposition.test.ts` y `src/tests/desktopServer.test.ts`: pruebas unitarias de selección sin borrador y disponibilidad/seguridad del endpoint.
- `PROBAR_DIRECT_COMPOSICION_WINDOWS.ps1`: prueba **externa**, no parte de la interfaz de producción; activa temporalmente `lower-third` y `banner` ya publicados mediante cambios exclusivamente operativos y restaura las banderas al terminar.

**Validaciones pendientes**

- Esta modificación se realizó después de las verificaciones Windows informadas por el usuario. Volver a ejecutar `npm run lint`, `npm run test:core`, `npm run build` y `npm run desktop:server`.
- Probar en StreamYard la composición múltiple y Motion sin pérdida de frames perceptible.
- La aplicación todavía **no conecta los botones originales En Vivo con el motor directo**, y no hay dos monitores de video reales Preview/Program. Tampoco hay escenas independientes ni interfaz de configuración. Por tanto **NO declarar integración v5.0 terminada**.
- La ruta compositiva aplica un orden determinista catálogo → gráficos personalizados. El orden específico por escena y las transiciones entre escenas pertenecen al siguiente hito.
- El estado `running` del supervisor solo confirma que el proceso informó `SALIDA ACTIVA`, **no confirma** que StreamYard haya consumido fotogramas.

**Prueba acotada**

1. `git pull origin v5-native`; ejecuta las cuatro verificaciones; detén OBS MASTER Desktop y el Python externo antes de actualizar.
2. Vuelve a copiar `dist` a `desktop-app/dist` y ejecuta `npm start` desde `desktop-app` (ver instrucciones de fase anterior).
3. Inicia Unity Camera **desde la bandeja** y comprueba `http://127.0.0.1:3000/api/direct/status` (estado running).
4. Con StreamYard seleccionando `Unity Video Capture`, ejecuta desde el raíz `powershell -ExecutionPolicy Bypass -File .\\PROBAR_DIRECT_COMPOSICION_WINDOWS.ps1`. Deben aparecer banner y lower-third al mismo tiempo.
5. Presiona ENTER en el test y observa que ambas gráficas regresan al estado original. Verifica que detener/reiniciar sigue funcionando.

**No integrar ni fusionar hasta lograr paridad real en En Vivo + Preview/Program y test de emisión**.


## Implementación incremental — Program real dentro de En Vivo (RC3)

- `desktop-app/lab/direct_monitor.py`: emite fotogramas JPEG reales de Program por HTTP loopback tokenizado. Monitor aproximado 640×360 / hasta ~7.5 FPS, independiente de la salida configurada a 1280×720 / 30 FPS.
- `desktop-app/lab/direct_graphics.py`: publica para monitor cada cuarto fotograma después de `cam.send()`. Sigue usando Unity Capture y Playwright corregidos. Python conserva el apagado cooperativo.
- `desktop-app/direct-process.cjs`: genera token aleatorio en cada inicio y lo transmite solamente al proceso hijo.
- `desktop-app/server.ts`: proxy `GET /api/direct/program.mjpg`, comprobación de host/origen same-origin, entrega JPEG multipart mediante monitor de proceso activo. No confundirlo con confirmación de recepción en StreamYard.
- `desktop-app/main.cjs`: vincula el proxy al supervisor.
- `src/App.tsx`: consulta `/api/direct/status` cada 2 segundos, usando solo el resultado del supervisor.
- `src/components/spaces/BroadcastControlSpace.tsx`: el monitor **Program original** muestra video real, con fallback y reintento; el monitor Preview conserva la caja original y advierte que aún está pendiente.
- `src/tests/desktopServer.test.ts`: pruebas de accesos cross-site y estado no disponible.
- `PROBAR_MONITOR_PROGRAM_RC3.md`: guía de validación Windows; no compilar directamente sobre la instalación 4.2.

**Pendiente y bloqueo:** todavía no se implementaron monitores independientes Preview/Program ni acción `take` sobre snapshots de escenas; se mantuvo el Panel En Vivo, pero algunas funciones siguen requiriendo OBS WebSocket. Este RC3 es solo un hito de monitoreo, **no la migración completa**. Confirmación real de visualización y rendimiento requerida en Windows.

## Implementación incremental — RC4B Take/Cut nativo (2026-10-21)

**Alcance: código implementado, NO probado todavía en Windows.** El usuario validó RC4A con Preview independiente y Program/StreamYard inalterados.

- El Panel En Vivo original ahora envía **Cut** desde el botón de transición existente, sin nueva vista.
- `/api/direct/take`: mismo origen, acepta solo Cut, revision optimista, exige motor Unity en `running`.
- `stationBridge.ts`: mutex de transición y commit único de flags de Program **después de ACK de motor**, sin alterar borradores/versiones. La selección de Preview sigue aislada.
- `direct_graphics.py`: toma un screenshot de Preview verificado mediante marcador antes/después; lo aplica solo al hilo de video Unity y emite `STDQ_TAKE_ACK` **después de `cam.send()`**. En errores admite `ROLLBACK`. La superposición temporal permanece hasta que el renderizador Program capturó el ID confirmado.
- `direct-process.cjs`: vincula comandos stdin TAKE/ROLLBACK con ACK de fotograma por stdout, maneja timeouts y cierre del proceso.
- `DirectCompositeRenderer`: publica marcadores de revisión Preview y de Take committed desde SSE.
- `src/tests/desktopServer.test.ts`: rechazo por origen ajeno, no modificar Program antes de ACK, exclusividad durante Take, publicación después de ACK, rollback por fallo.
- `INICIAR_RC4A_VERIFICADO_WINDOWS.bat`: suma `py_compile` y marcador de JS RC4B.
- Ver ensayo reproducible en `PROBAR_TAKE_NATIVO_RC4B.md`.

**Riesgos/pendientes:** Un ACK de `cam.send()` no confirma entrega a StreamYard. Una reversión solicitada después de un primer frame no puede borrar ese frame ya emitido. Se debe probar latencia, estado coherente después del Cut, rendimiento, 20 ciclos y fallos de engine. Transiciones animadas, acciones Program no ligadas a OBS, escenas propias, Configuración y empaquetado autónomo todavía pendientes. **No fusionar en main ni emitir públicamente con RC4B no validado**.
