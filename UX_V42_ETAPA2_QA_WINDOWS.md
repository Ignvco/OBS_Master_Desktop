# OBS MASTER V4.2 — ETAPA UX 2 / GUÍA DE VALIDACIÓN WINDOWS

**Rama:** `ux-v42-experiencia` · **Referencia protegida:** `main` · **No modificar:** `v5-monitor-async`.

## Cambios de la Etapa 2
1. **En Vivo:** cada tarjeta informa estado y tiene un botón separado **Mostrar en Program / Ocultar de Program**. El bloque informativo ya no publica nada al hacer clic. Conserva el mismo handler `onToggleComponentVisibility` de V4.2.
2. **En Vivo:** escenas con `title`/nombre accesible según Modo Estudio (Preview vs Program). Estado de protección visible, sin cambiar su funcionamiento.
3. **Content Studio:** selector **Guías y fondo** plegable para reducir elementos en torno al lienzo; opciones de cuadrícula, zonas seguras y fondos preservadas. Inspector avanzado se expande al navegar a una herramienta avanzada, y vuelve a Rápido si se colapsa mientras esa herramienta está activa. Etiquetas del catálogo más claras.
4. **Inicio:** orientación **Mostrar/Ocultar** no intrusiva y persistente en una preferencia local UX; nombre de estado de cámara virtual preciso; contador de gráficas dinámico, sin confundir bandera de visibilidad con video confirmado.

## Verificaciones estáticas
Se revisaron diferencias y fragmentos del código en GitHub, sin alterar servicios ni motor. **El código modificado en esta etapa NO se ha compilado/ejecutado con Node ni probado visualmente en Windows todavía.** No confundir pruebas históricas de la Etapa 1 con una nueva ejecución exitosa.

## Ejecución de pruebas técnicas — Windows
1. Cerrar otras instancias OBS MASTER, respaldar datos/estado y utilizar un clon separado. Evitar duplicación del puente local por puerto en ejecución.
2. `git checkout ux-v42-experiencia && git pull --ff-only origin ux-v42-experiencia`.
3. `PROBAR_UX_V42_WINDOWS.bat` (invoca el conjunto existente: TypeScript, `test:core`, TypeScript del servidor, build).
4. Anotar resultados completos. **No correr GitHub Actions**.

## Prueba manual UX con OBS desconectado
- Abrir Inicio: leer el nuevo estado, ocultar orientación, cambiar de espacio y volver. Debe mantenerse oculta; permitir mostrarla otra vez.
- Diseñar: abrir una gráfica, modificar su texto, comprobar borrador/versión publicada. Abrir/Cerrar «Guías y fondo», comprobar que siguen funcionando cuadrícula, zonas seguras, fondo y zoom.
- Inspector: explorar Rápido, Contenido, Capas, Animar. Abrir «Más herramientas», usar Texto/Forma/Logo/OBS; la pestaña activa no debe quedar oculta después de cambiarla por código.
- Probar ancho 1920×1080, 1366×768 y 1280×720 con escala Windows habitual. Buscar superposiciones, barras desbordadas y botones inaccesibles.
- En Vivo: comprobar botones deshabilitados cuando OBS está desconectado y etiquetas «Mostrar/Ocultar» visibles. No confundir la maqueta Preview/Program con video real.

## Prueba manual operacional con OBS real (solo escena de ensayo, sin StreamYard en emisión)
- Conectar OBS y activar Modo Estudio. Hacer clic en una escena: solo cambia **Preview**. Ejecutar la transición instalada y verificar Program mediante OBS.
- Desactivar Modo Estudio, primero comprobando que **Modo Protegido** bloquea las operaciones previstas. Con protección desactivada, el selector puede cambiar **Program directamente**: comprobar advertencia y etiqueta del botón.
- Publicar un borrador desde Content Studio con fuente no visible; confirmar que solo cambia el diseño publicado. Restaurar snapshot solo al borrador; no debe alterar Program.
- Desde En Vivo, comprobar gráfico vinculado: **Mostrar en Program**. Su tarjeta indica visible, botón cambia a **Ocultar de Program**. Repetir Motion. Ocultar y verificar animación de salida/fuente OBS.
- Probar la ausencia de vínculo, un vínculo ambiguo y ausencia de escena Program: no permitir mostrar; explicar estado.
- Verificar el botón **Despejar gráficas**; no modifica escenas. Revisar conteos y estado en Inicio.
- Confirmar la cámara virtual en OBS; comprobar recepción en StreamYard **sin afirmar transmisión pública**. No iniciar directo en producción con esta rama.

## Criterios de aceptación
- Cero clics accidentales de activación al tocar una tarjeta descriptiva.
- La acción de cada gráfica siempre comunica **Mostrar en Program / Ocultar de Program**.
- Modo Estudio y Modo Protegido nunca ocultan el efecto del selector de escenas.
- Inicio no muestra «transmitiendo» como sinónimo de cámara virtual activa.
- Canvas/inspector utilizables sin barras superpuestas.
- Publicación, historial, fuentes OBS, animaciones, persistencia, recuperación y emisión sin regresión.
- Tests y build local exitosos + ensayo OBS real + aprobación UX antes del merge.

## Foco del próximo ciclo
Afinar proporciones y posiciones a partir de capturas reales Windows. Medir comprensión con el Director Técnico y un operador nuevo. Evaluar conservar la gráfica seleccionada al entrar desde Diseñar a En Vivo, sin crear un segundo flujo de publicación.

**Estado:** Etapa 2 subida para revisión en PR draft; Windows QA y pruebas de usuario pendientes. No fusionar.
