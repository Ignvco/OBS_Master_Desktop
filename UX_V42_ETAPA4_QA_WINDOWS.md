# OBS MASTER V4.2 — UX ETAPA 4: ERGONOMÍA DE REALIZACIÓN

Rama: `ux-v42-experiencia` · PR draft #8 · Base `main`. No mezclar con V5.

## Qué cambió (presentación, no transmisión)
1. **Acceso a escenas antes de los monitores:** el selector se mueve por encima de Preview y Program, con matriz responsiva y lista de altura acotada. No se agrega otra ruta de cambio de escena ni se duplica el selector.
2. **Monitores esquemáticos compactos por defecto:** altura reducida, mensajes breves de «no video real»; control Ampliar/Compactar monitores y persistencia local en `stdq-v42-live-compact-v1`. La representación ampliada original permanece disponible.
3. **Gráficas de En Vivo en todo el ancho:** tarjetas operacionales en una cuadrícula responsive (1/2/3/4/5 columnas según ancho). Mantienen botones separados «Mostrar en Program» / «Ocultar de Program» y controles secundarios.
4. **Estado veraz:** Preview aparece sin señal activa cuando falta OBS o Modo Estudio; Program no presenta tally rojo activo si falta conexión/escena; se muestra cantidad de fuentes gráficas habilitadas en Program según estado de OBS, no «transmisión pública confirmada». Si OBS no devuelve escenas, aparece orientación.
5. **Cabecera responsiva:** controles de Modo Estudio, vista compacta y emergencia pueden distribuirse en más de una línea sin desbordar.
6. **Editor en ventanas bajas:** se disminuye el alto de la barra de publicación e inspector con una regla CSS solo bajo 820 px de alto; no se modifican servicios ni Browser Source.
7. **Editor y publicación:** una bandera local `visibleInOBS` se denomina «Marcada visible», no «Al aire» como hecho demostrado. Publicar continúa bloqueado conforme al contrato ya existente.

## Invariantes que hay que probar
- Cambiar la vista compacta solo cambia la presentación. No modifica OBS, escenas, cámara virtual ni gráficas.
- Seleccionar escena en Modo Estudio prepara Preview. Con Modo Estudio OFF y sin protección puede cambiar Program directamente; con protección activa no debe hacerlo.
- El control de transición sigue utilizando el catálogo real de OBS y conserva deshabilitado cuando la operación no es válida.
- Las tarjetas mantienen URL/binding validado, estado pendiente, Motion y comandos explícitos de mostrar/ocultar.
- El número de fuentes habilitadas es un dato OBS, NO una verificación de imagen ni publicación externa.
- No hay cambios en `obsWebSocket.ts`, backend, compositor, historial, router de overlays, animaciones o `v5-monitor-async`.

## QA técnico en Windows (sin emisión pública)
1. Respaldar AppData y usar clon de ensayo. Verificar que no haya modificaciones locales con `git status --short`.
2. Actualizar la rama en el clon: `git pull --ff-only origin ux-v42-experiencia`.
3. Ejecutar `PROBAR_UX_V42_WINDOWS.bat`. Conservar la salida íntegra, especialmente lint/TypeScript, 158 tests del conjunto conocido y build; **no afirmar resultados antes de ejecutarlo**.
4. Abrir la app sin OBS: comprobar los textos «OBS desconectado», «Preview no disponible», selector sin escenas y ausencia de indicación roja de Program activo.
5. Evaluar En Vivo a 1920×1080, 1366×768 y 1280×720. En los tres tamaños, verificar que estén visibles los botones críticos, que no haya desbordamientos horizontales ni textos superpuestos, y que el selector sea alcanzable sin desplazamiento excesivo.
6. Cambiar de vista compacta a ampliada y de vuelta, salir de En Vivo y regresar. Confirmar persistencia de preferencia y **mismos estados de OBS**.
7. Con OBS de ensayo y Modo Estudio activo: preparar escenas, transición, verificar Program real externamente. Repetir pruebas de Modo Protegido, ausencia de escenas y Browser Sources vinculadas, ambiguas y ausentes.
8. Mostrar/ocultar gráficas desde botones individuales y revisar que vista compacta muestra el número correcto de fuentes habilitadas. Confirmar Motion y acción Despejar Gráficas en escenas de ensayo.
9. En Diseñar, comprobar canvas e inspector a altura 720 y 768: abrir Forma, Motion e historial; validar guardado, publicación, bloqueo cuando figura visible y recuperación solo al borrador.

## Pruebas realizadas en esta sesión
- Revisión de diferencias desde GitHub.
- Comprobación estructural de JSX: etiquetas principales balanceadas (incluidos 8 `span` autocerrados) y orden de secciones.
- Confirmación de selector único, estado de vista local, handlers OBS intactos.
- **NO fue posible compilar, ejecutar TypeScript, Node/test:core ni inspeccionar visualmente la app en Windows en este entorno.** La validación técnica de etapas anteriores no certifica Etapa 4.
- **NO se ejecutó GitHub Actions.**

**No fusionar #8 a main** sin resultados de Windows, OBS de ensayo y aprobación UX.
