# OBS MASTER v4.2 RC1 — Control de versiones y En Vivo

## Alcance

**Incluido:** gestión de snapshots manuales, restauración segura al borrador, controles para renombrar/proteger/eliminar revisiones, publicación independiente; validación de fuentes Browser OBS por URL, detección automática, estado detallado en En Vivo, acceso a edición y replay de Motion; herramientas de Content Studio con tab bar anclada, panel Forma organizado y superficie plegable.

**Excluido expresamente:** StreamYard directo, exportaciones, nuevos motores de gráficos o modificación del renderer, cambios de salida, cámara o arquitectura de streaming.

## Semántica del historial (CAMBIO de V4.1)

1. **Guardar versión:** crea un único snapshot intencional desde el borrador actual (máximo 20 por gráfica).
2. **Publicar:** reemplaza exclusivamente la versión publicada por el borrador actual, sin generar un snapshot.
3. **Recuperar borrador:** copia un snapshot histórico al borrador actual, sin modificar la salida publicada ni crear otra versión. Puedes hacerlo mientras una gráfica está visible, porque no altera la emisión.
4. **Gestionar:** permite renombrar, proteger/desproteger y borrar snapshots. Los protegidos no se borran ni se expulsan al guardar otro snapshot; cuando hay 20 protegidos se solicita desproteger uno antes de guardar.
5. El contador interno `currentVersion` ahora se usa como identificador monótono de snapshots, **no** como número de publicaciones. El historial antiguo de v4.0/v4.1 se conserva.
6. No existe un historial automático de cada publicación. Si necesitas una copia antes de editar o emitir, pulsa **Guardar versión** explícitamente.
7. La recuperación al borrador reemplaza los cambios actuales no guardados como snapshot. Es aconsejable guardarlos primero.

## Pruebas automáticas incluidas

Ejecuta `PROBAR_V42_WINDOWS.bat` en una copia del proyecto. Requiere Node.js y dependencias Windows (`npm ci`). Comprueba TypeScript, pruebas de API en servidor local efímero, compatibilidad con snapshots y simulación de OBS WebSocket, compilación Electron y Vite. No escribe sobre la carpeta de configuración real de OBS.

## Pruebas manuales obligatorias antes de transmitir

**1. Persistencia y recuperación**
- Haz una copia de seguridad de la carpeta v4.1 y AppData (desde Recovery Center).
- Abre una gráfica de prueba, pulsa Guardar versión y pon nombre A.
- Modifica texto, crea versión B. Renombra A, protégela y comprueba que no se pueda borrar.
- Recupera A al borrador y comprueba que el publicado **no** cambia.
- Publica estando la gráfica **fuera del aire** y comprueba que A y B siguen siendo solo dos revisiones.
- Cierra totalmente la app y vuelve a abrirla: valida nombres, protección y borrador.

**2. Conexión OBS y bloqueo en emisión**
- Conecta OBS WebSocket 5 en la PC Windows.
- Configura una escena Program con una Browser Source de prueba de URL propia.
- Comprueba detección automática por URL, no por nombre. Renombra la fuente OBS y sincroniza/reconecta: debe seguir detectándola si URL es correcta.
- Usa otra Browser Source con URL de una gráfica distinta: NO debe poder operarse desde la tarjeta errónea.
- Activa la gráfica y pulsa Publicar: debe bloquearse. Desactívala completamente y vuelve a publicar.
- Durante Program, repite Motion y verifica que solo reinicie su animación (sin modificar diseño ni crear versiones).
- Retira la fuente, comprueba tallies y estado de los botones.

**3. Inspector / Forma**
- Abre Content Studio con panel inspector ancho mínimo (300 px) y máximo (560 px).
- Selecciona Forma y confirma que sus ocho pestañas permanecen visibles y accesibles, sin superponerse.
- Abre la sección plegable de color, degradado, sombra y bordes, comprueba el scroll interno.
- Usa el editor de capas y el control Motion; no deben afectar el diseño publicado hasta pulsar Publicar.

**4. Emergencia**
- Crea varios overlays de prueba, prueba la acción Pánico: despejar gráficas, restaura copia de seguridad solo fuera de emisión.
- Repite el ensayo de conexión/desconexión y confirma que no aparezcan falsos estados de emisión.

## Limitaciones de la validación en este entorno

- 158 pruebas automatizadas aprobadas; TypeScript (`tsc --noEmit`) y compilación TypeScript del servidor Electron aprobadas.
- No se ejecutó el instalador ni una sesión real de OBS WebSocket en Windows desde este entorno Linux.
- El empaquetado frontend con Vite/Rolldown queda pendiente en Windows porque la copia de las dependencias contiene binarios nativos de Windows, no de Linux.

**Política de datos:** no borres AppData ni el historial de la instalación previa; entrega en ZIP incremental, aplica sobre una copia. No instales v4.2 durante una transmisión real.
