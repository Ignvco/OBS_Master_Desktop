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
