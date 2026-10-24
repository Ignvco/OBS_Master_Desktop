# OBS MASTER V4.2 — CONSOLIDACIÓN UX 1–5 / GATE DE ACEPTACIÓN

**Fecha:** 2026-10-24
**Repositorio:** `Ignvco/OBS_Master_Desktop`
**Rama a validar:** `ux-v42-experiencia`
**PR:** [#8](https://github.com/Ignvco/OBS_Master_Desktop/pull/8) (DRAFT)
**Rama protegida:** `main`
**Fuera del alcance:** `v5-monitor-async`, V5 Direct, motor Python/Unity, sustitución de OBS.

## Objetivo de consolidación

Evitar seguir sumando componentes sin medir si el rediseño es estable, legible y seguro.
El criterio de éxito es que las cinco etapas funcionen juntas sin alterar las operaciones técnicas de OBS Studio.

## Cambios ya incluidos

- Navegación centrada en tareas: Inicio → Diseñar → Preparar → En Vivo → Biblioteca.
- Content Studio: borrador/publicación explicados por separado de mostrar una Browser Source en Program; historial agrupado, inspector gradual, canvas con herramientas plegables.
- En Vivo: escenas accesibles primero; Preview/Program esquemáticos ampliables o compactos; transiciones reales; búsqueda y filtros de gráficas; botones de Mostrar/Ocultar explícitos; estado de fuentes y guía de vinculación.
- Selección contextual: Diseñar → En Vivo conserva el ID, pero navegación global a En Vivo limpia selecciones antiguas. El operador puede quitar la selección sin afectar OBS.
- Modo Estudio, Modo Protegido, fuente ausente/ambigua y ausencia de Preview se comunican antes de acciones peligrosas.
- Accesibilidad: estados de los botones, títulos informativos y foco de teclado en acciones críticas.
- Cámaras virtuales: botones deshabilitados sin conexión OBS; activar cámara no implica emitir por StreamYard.
- Monitor de Program: indica estado de fuentes OBS, **no** video real ni transmisión pública verificada.
- Ajustes en Windows con poca altura, sin modificar los gráficos HTML de salida.

## Protección técnica

Todos los cambios deben permanecer fuera del motor de emisión:
- No editar `src/services/*`, `src/utils/liveSources.ts`, `src/components/overlays/*`, WebSocket ni almacenamiento operativo para esta fase.
- Conservar exactos los handlers ya conectados de escena, transición, visibilidad, Motion, cámara, publicación y recuperación.
- No fusionar el PR hasta que la verificación de Windows sea satisfactoria y el usuario apruebe.

## Paso 1 — Ejecutar en Windows (sin abrir OBS)

La carpeta de ensayo debe ser un clon aislado del proyecto, no una instalación en uso.

```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v42-UX"
git status --short
git pull --ff-only origin ux-v42-experiencia
PROBAR_UX_V42_WINDOWS.bat
```

**Advertencia:** Si `git status --short` informa cambios locales, guardar o revisar esos cambios antes del pull. El comando `git pull --ff-only` no debe pisarlos.

El archivo `PROBAR_UX_V42_WINDOWS.bat` ejecuta las comprobaciones de `PROBAR_V42_WINDOWS.bat` y guarda un registro en:

`%TEMP%\OBS_MASTER_V42_UX_QA.log`

Incluye **9 nuevas pruebas estáticas de contrato UX** en `src/tests/uxV42Consolidation.test.ts`, integradas automáticamente en `npm run test:core`. Son pruebas de regresión de código y **no reemplazan una prueba funcional real**.

### Aceptación automática

- `npm run lint`: exit 0.
- `npm run test:core`: exit 0.
- `npm run desktop:server`: exit 0.
- `npm run build`: exit 0.
- El .bat termina con código 0 e imprime la ruta del log.

Si alguna etapa falla: **no fusionar ni instalar como reemplazo de V4.2**. Guardar el log para depurar.

## Paso 2 — Validación de ergonomía sin OBS

Inspeccionar con tamaño real de ventana de Windows:

| Escenario | Resultado esperado |
|---|---|
| 1920×1080, 1366×768, 1280×720 | Navegación y controles accesibles; sin texto cortado ni desbordamiento horizontal inesperado |
| Primera apertura | Inicio explica Diseñar → Preparar → En Vivo; guía se oculta/recupera |
| Diseñar | Inspector Rápido, Contenido, Capas, Animar y Más herramientas accesibles |
| Historial | Guardar versión ≠ Publicar. Recuperar al borrador no reemplaza lo publicado |
| En Vivo sin OBS | Preview no disponible, Program desconectado y botones de salida deshabilitados |
| Cambiar monitores | Compacto ↔ Ampliado solo modifica altura de la representación esquemática |
| Navegación normal | En Vivo no conserva selección antigua |
| Diseñar → En Vivo | Se destaca la gráfica seleccionada, sin activar fuente ni escena |
| Teclado | Controles principales alcanzables con Tab, estado de foco visible y activación Enter/Espacio |

## Paso 3 — Ensayo OBS sin transmisión pública

Realizar solo con colección y escena de prueba en OBS:

1. Conectar OBS WebSocket v5 y observar confirmación.
2. Con Modo Estudio activo, seleccionar una escena: solo cambia Preview; comprobar directamente en OBS.
3. Transicionar con nombre realmente detectado por OBS; confirmar Program.
4. Verificar que Modo Protegido evita abandonar Modo Estudio y cambiar Program directamente.
5. Desproteger deliberadamente y comprobar la operación directa prevista, luego volver a proteger.
6. Crear/vincular una Browser Source de prueba y revisar URL: ninguna fuente no validada puede mostrarse.
7. Buscar gráfica por su etiqueta y nombre propio; filtrar Todas / En Program / Por revisar.
8. Mostrar gráfica, comprobar estado OBS, ocultar y repetir Motion con gráfico de ensayo.
9. Simular vínculo ambiguo o ausente: botón Mostrar debe permanecer bloqueado, aparecer «Revisar fuente OBS» y permitir reparar sin activación automática.
10. Verificar el comando Despejar gráficas en ensayo, sin cambio de escena.
11. Comprobar cámara virtual en OBS; verificar visualmente StreamYard sin iniciar directo público.
12. Revisar persistencia al cerrar y reabrir, y restaurar un snapshot únicamente al borrador.

## Paso 4 — Evaluación UX del Director Técnico

Asignar tres tareas reales sin explicar la ubicación previa de botones:
- Crear una gráfica, guardar una versión, publicar diseño, encontrarla en En Vivo y mostrarla en OBS.
- Preparar escena Preview y ejecutarla a Program, distinguiendo exactamente cuándo cambia la salida.
- Recuperar un borrador sin alterar la publicación ni afectar la escena activa.

**Registrar**: finalización sin ayuda (sí/no), errores críticos, controles mal interpretados y observaciones en 1366×768.
No inventar puntuaciones o resultados; las pruebas con personas todavía no se han ejecutado.

## Estado real en esta sesión

- GitHub: comparación `main...ux-v42-experiencia` realizada. Cambios de UI, guías y pruebas; no se modificaron servicios, renderer de Browser Sources, backend ni motor OBS.
- Auditoría estática y revisión de 9 nuevos contratos UX: realizada.
- TypeScript, Node `test:core`, desktop:server, build, screenshot de Windows, OBS y StreamYard: **pendientes de ejecutar**, no reportados como aprobados.
- GitHub Actions: **no ejecutado**.
- Pull request: **mantener DRAFT**, no fusionar.

**Gate de producción:** pruebas automáticas + ensayo OBS + revisión UX + aprobación explícita del usuario.
