# OBS MASTER V4.2 — UX ETAPA 5: RECORRIDOS, RECUPERACIÓN Y ACCESIBILIDAD

**Repositorio:** Ignvco/OBS_Master_Desktop
**Rama aislada:** `ux-v42-experiencia`
**PR:** #8 (draft)
**No modificar ni fusionar:** `main`, `v5-monitor-async`
**Arquitectura:** OBS Studio + OBS WebSocket v5 + OBS Virtual Camera; **no es V5 Direct**.

## Problema 1 — Gráfica seleccionada que persiste en la mesa
**Antes:** `liveFocusGraphic` persistía incluso cuando el operador entraba a En Vivo desde la navegación principal, dejando destacada la última gráfica que había editado.
**Ahora:** `navigateWorkspace` limpia el foco al entrar por Header o Inicio; exclusivamente `onGoLive(id)` desde Diseñar conserva la selección. Aparece un mensaje contextual **Gráfica seleccionada** y opción de **Quitar selección**. Para un gráfico propio aún no publicado, se conserva el aviso y regreso a Diseñar.
**No cambia:** el estado de publicación, la visibilidad de la fuente OBS ni el borrador.

## Problema 2 — Gráfica deshabilitada sin solución visible
**Antes:** si faltaba un Browser Source válido o el vínculo era ambiguo, el botón Mostrar aparecía deshabilitado, pero el operador debía buscar dónde repararlo.
**Ahora:** cuando OBS y escena Program existen, se ofrece un botón contextual **Revisar fuente OBS** o **Resolver vínculo ambiguo**, que abre la configuración de fuentes y los detalles de la gráfica.
**No cambia:** verificación por URL, vínculo por escena, validaciones, creación de fuentes, ni emisión automática. El botón de revisión jamás hace que una gráfica salga al aire.

## Problema 3 — Acciones sin contexto de seguridad
**Antes:** abandonar Modo Estudio podía ofrecer una acción que Modo Protegido bloquearía luego; el botón Transición también podía habilitarse sin una escena Preview recibida.
**Ahora:** el botón de Modo Estudio respeta la restricción de Modo Protegido al desactivarlo y explica su estado mediante `title`/`aria-pressed`. Transición permanece deshabilitada si OBS todavía no informa una escena Preview. Un aviso orienta a seleccionar una escena primero.
**No cambia:** `handleToggleStudioMode`, `handleExecuteTransition` ni eventos WebSocket.

## Problema 4 — Búsqueda con nombres distintos
**Antes:** el buscador comparaba únicamente la etiqueta de la tarjeta.
**Ahora:** también utiliza `config.name`, nombre del diseño publicado; conserva búsqueda local sin operaciones OBS.

## Accesibilidad
Se agrega foco de teclado visible a selección de escenas, transición y botones principales Mostrar/Ocultar, sin sustituir comportamientos nativos de los botones. Los estados de Modo Estudio son comunicados mediante `aria-pressed`.

## Comprobaciones realizadas
- Inspección estática de `src/App.tsx`, `BroadcastControlSpace.tsx`, `ContentStudioSpace.tsx` en el GitHub real de la rama UX.
- Verificación de interfaces y callback de foco: App ↔ En Vivo, editor ↔ App y navegación global.
- Inspección de equilibrio de `div`, `button`, `section`, `span`, `p`, `strong`, `label`, `select`, `input` (un input autocerrado).
- Confirmación de ninguna modificación prevista al renderer de Browser Sources, backend, OBS WebSocket o contratos de guardado.
- **No se ejecutaron TypeScript, build o `test:core` para Etapa 5**. El entorno de ejecución local de esta sesión no está disponible; no inferir éxitos de pruebas anteriores.
- **No se ejecutaron GitHub Actions.**

## QA obligatorio Windows
Utilizar copia separada `OBS-Master-v42-UX`. Resguardar AppData; no probar durante una transmisión:
1. `git status --short`; resguardar modificaciones si existen.
2. `git pull --ff-only origin ux-v42-experiencia`.
3. `PROBAR_UX_V42_WINDOWS.bat` y conservar log completo de TypeScript, lint, `test:core`, servidor y build.
4. Abrir En Vivo desde Inicio: ninguna gráfica previamente editada debe quedar marcada como «Seleccionada desde Diseñar».
5. Ir a Diseñar → seleccionar una gráfica **publicada** → Gestionar en En Vivo: debe mostrar la gráfica con borde de selección y nombre claro, sin activarla. «Quitar selección» debe eliminarlo.
6. Crear gráfica independiente pero no publicarla → En Vivo: debe mostrar aviso de contenido no publicado, con enlace a Diseñar y posibilidad de cerrar aviso.
7. Con OBS **de ensayo** conectado, abrir una gráfica sin fuente: Mostrar en Program deshabilitado; «Revisar fuente OBS» debe desplegar el selector y los detalles, **sin activar fuentes**.
8. Crear caso de vínculo ambiguo y repetir; no permitir mostrar hasta resolverlo. Verificar que no se acepte enlazar webcam en lugar de Browser Source.
9. Modo Protegido activo + Modo Estudio activo: «Modo Estudio» debe quedar deshabilitado para apagarlo; desproteger intencionalmente y comprobar comportamiento original.
10. Modo Estudio activo pero sin Preview recibida: transición deshabilitada + aviso. Preparar escena y confirmar transición en OBS real.
11. Recorrer con Tab y activar mediante Enter/Espacio: distinguir visualmente el foco y que los controles de búsqueda, configuración, escenas y gráficas responden según su etiqueta.
12. Verificar 1366×768, 1280×720 y 1920×1080: nada crítico debe quedar inaccesible.
13. Confirmar persistencia, publicaciones, snapshots, Motion y salida de cámara virtual en OBS/StreamYard de ensayo sin emisión pública.

## Regla de aceptación
No fusionar PR #8 a `main` hasta tener compilación/tests actuales aprobados, evidencia visual de Windows, ensayo broadcast y evaluación por el operador o Director Técnico.

**Estado: implementación UX Etapa 5 en revisión; QA Windows pendiente.**
