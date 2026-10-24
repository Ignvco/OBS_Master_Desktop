# OBS MASTER V4.2 — UX ETAPA 3 / REVISIÓN SEGURA DE LA MESA EN VIVO

**Rama:** `ux-v42-experiencia` · **PR:** #8 (draft) · **Base:** `main` · **NO alterar:** `v5-monitor-async`.

## Alcance implementado
- **Diseñar → En Vivo:** navegación contextual conserva el ID de la gráfica seleccionada (`App.tsx` + `ContentStudioSpace.tsx` + `BroadcastControlSpace.tsx`). Si existe como publicación, su tarjeta se destaca y se ubica en la vista. Si el diseño personalizado aún no se ha publicado, se explica el requisito y se ofrece volver a editar; **no** se crea ni publica nada automáticamente.
- **En Vivo:** búsqueda por nombre y filtros de presentación Todas / En Program / Por revisar. Son filtros locales, no comandos OBS. Cuando no hay resultados, aparece estado vacío que sugiere volver a Todas o limpiar búsqueda.
- **Selector de escenas:** su descripción y nombre accesible cambian con Modo Estudio. Con Modo Estudio desactivado y Modo Protegido activo, el selector directo a Program aparece deshabilitado, coherente con las restricciones ya impuestas por `App.tsx`.
- **Estado de emisión:** la conexión con OBS utiliza un indicador verde; el estado de cámara virtual en la navegación es azul, **no rojo de emisión pública**. Program continúa siendo representación esquemática; verificar señal real en OBS.
- **Header:** se elimina el acceso duplicado a la misma configuración OBS.
- **En Vivo:** la tira de cinco estados utiliza una cuadrícula de cinco columnas en pantallas amplias, tres intermedias, dos estrechas y una muy estrecha.

## Invariantes (obligatorios)
No modificar handlers reales: `onSetPreviewScene`, `onSetProgramScene`, `onExecuteTransition`, `onToggleComponentVisibility`, `onHideAllComponents`, `onReplayGraphic`, `onPublishGraphic`. No tocar `obsWebSocket.ts`, renderer de Browser Sources, WebSocket, servicio de publicación, historial, persistencia operacional, OBS Virtual Camera ni StreamYard. No introduce Unity Camera/Python/V5.

## Procedimiento de validación local
**NO EN UNA TRANSMISIÓN REAL.** Usar Windows 10 y un clon de `ux-v42-experiencia` separado de la versión operativa. Cerrar apps previas y respaldar AppData antes de iniciar la copia.

1. En CMD:
   `cd /d "%USERPROFILE%\\Desktop\\OBS-Master-v42-UX"`
   `git status --short` (si aparecen modificaciones propias, no sobrescribir)
   `git pull --ff-only origin ux-v42-experiencia`
   `PROBAR_UX_V42_WINDOWS.bat`
2. Primero con OBS cerrado, revisar Inicio, Diseñar, Preparar, En Vivo, Biblioteca; comprobar tamaños 1920×1080, 1366×768, 1280×720.
3. Diseñar: seleccionar gráfica previamente publicada → «Gestionar en En Vivo». Debe destacarla y situarla visible en el listado. Si una gráfica propia no está publicada, mostrar explicación y botón de retorno; ningún envío al aire.
4. En Vivo: buscar por nombre. Probar Todos / En Program / Por revisar; sin resultados debe aparecer explicación. Cambiar filtros no modifica fuentes ni escenas OBS.
5. Estado desconectado: acciones de fuentes desactivadas. Ninguna tarjeta informativa se comporta como un botón de emisión.
6. Con OBS real en **escenas de ensayo**, verificar selección de escena en Modo Estudio (Preview), transición a Program, Modo Protegido activo con Modo Estudio desactivado (selector bloqueado), y desprotección manual para cambiar Program directamente.
7. Vincular Browser Sources de ensayo; activar/ocultar gráfica y comprobar que el filtro «En Program» sigue su estado. Probar búsqueda de vínculo ausente o ambiguo, recuperación al borrador, historial y Motion. Confirmar en OBS real.
8. Confirmar estado de cámara virtual; no confundir con StreamYard emitiendo. Sin emisión pública durante las pruebas.
9. Confirmar seguridad del botón Despejar Gráficas en escenas de ensayo. No debe efectuar transición de escena.

## Resultado esperado y estado
- Diferenciar estados técnicos y emisión real sin ambigüedad.
- Encontrar la gráfica de Diseñar al navegar a En Vivo.
- Buscar/filtrar sin ninguna acción sobre OBS.
- No regresiones de funcionamiento, almacenamiento, animación, transparencia ni estado al aire.
- Validar con el usuario y el Director Técnico si realmente baja la confusión.

**Revisión estática:** los archivos modificados fueron comprobados en GitHub; el diff `main...ux-v42-experiencia` contiene únicamente cambios de UI y documentación.
**Pendiente:** prueba compilación + tests automáticos **de esta etapa** en Windows; inspección visual Windows y comprobación de OBS real. No se ejecutaron GitHub Actions.

**No fusionar a `main` hasta aprobar QA de Windows y ergonomía.**
