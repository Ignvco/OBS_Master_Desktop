# OBS MASTER V4.2 — UX/UI Etapa 1 (sin modificar el motor)
**Base**: `main` (V4.2 RC1). **Rama de revisión**: `ux-v42-experiencia`. La rama `v5-monitor-async` no participa.

## Cambios implementados
- `Header.tsx`: navegación por tareas (Inicio → Diseñar → Preparar → En Vivo → Biblioteca), branding OBS MASTER V4.2, información clara de conexión, protección y acceso a configuración OBS existente.
- `MissionControlSpace.tsx`: deja de afirmar «listo para salir al aire» solo por OBS conectado + Virtual Camera activa; guía contextual con tres próximos pasos y recordatorio de verificar StreamYard externamente.
- `ContentStudioSpace.tsx` / `App.tsx`: nuevo acceso `Gestionar en En Vivo` sin ejecutar visibilidad OBS desde el canvas. Se preserva la operación real desde En Vivo. `Publicar diseño` se explica como publicación editorial, no emisión. Historial de versiones y sus acciones intactas agrupadas en desplegable; inspector con 4 herramientas básicas y 4 avanzadas; aviso de recuperar al borrador corregido.
- `BroadcastControlSpace.tsx`: destaca efecto del selector de escenas según Modo Estudio ON/OFF, destino de transición y emergencia visible; deja de equiparar Virtual Camera activa con StreamYard transmitiendo. Los monitores siguen siendo representaciones esquemáticas, no video real.
- `index.css`: estilos `ux-*` exclusivamente del editor.

## Contratos protegidos
No se cambian WebSocket, OBS Studio, browser source renderer, estado de publicación, snapshots, persistencia, recuperación, transiciones, control de cámara ni motores de transmisión. La cámara es OBS Virtual Camera, **no Unity ni Python V5**. Los handlers de realización y emergencia se conservan. No hay merge hacia `main` ni `v5-monitor-async`.

## Pruebas realizadas (entorno local)
- `tsc --noEmit` con TypeScript global 5.8.3: **sin errores**.
- `npm run test:core` con Node.js 22.16: **158 de 158 aprobadas**.
- Compilación nativa Windows con TypeScript 7 / Rolldown, prueba visual de V4.2 real y operación con OBS/StreamYard: **pendientes**. Dependencias cargadas en el entorno de desarrollo incluyen ejecutables de Windows no compatibles con Linux.

## Validación en Windows (NO durante un directo)
1. Usar un clon separado de `ux-v42-experiencia`. No reemplazar la instalación V4.2 existente ni borrar AppData.
2. Respaldar los datos compartidos (perfil, Biblioteca, AppData) y cerrar todas las instancias anteriores; OBS y StreamYard cerrados para la inspección UX inicial.
3. Ejecutar `PROBAR_UX_V42_WINDOWS.bat` / `PROBAR_V42_WINDOWS.bat`, luego abrir `INICIAR_WINDOWS.bat` solo en esa copia.
4. Recorrer los 5 espacios. Verificar versiones y recuperación al borrador, 8 herramientas de inspector, edición de Forma sin superposición, transición, bloqueos de publicar, carga de Browser Sources y botón de emergencia.
5. Capturas y pruebas a 1920×1080, 1366×768 y 1280×720; un pase posterior con OBS real, escenas de prueba y StreamYard sin emisión pública.

## Criterios de aceptación
- Distinguir guardar borrador / guardar versión / publicar / mostrar al aire sin confusiones.
- Cero cambios no intencionados de Program.
- Modo Estudio y destino de cada acción reconocibles antes de hacer clic.
- Inspector avanzado disponible sin saturar por defecto.
- Sin regresión de publicación, persistencia, animaciones o salida de OBS.
- Aprobar manualmente Windows y UX con un operador antes de fusionar.

**Estado: código UX Etapa 1 listo para revisión; Windows QA pendiente; no fusionar.**