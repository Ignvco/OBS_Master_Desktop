# OBS MASTER V4.2 UX — NOTAS DEL CANDIDATO DE LANZAMIENTO

**Proyecto:** Si Te Dijera Que? / OBS MASTER Desktop
**Canal:** Candidato interno de ensayo de Windows, todavía NO versión pública.
**Rama:** `ux-v42-experiencia` · PR #8 draft
**Versión técnica actual:** `4.2.0-rc.1` (debe diferenciarse antes del lanzamiento final).
**Fecha del plan:** 2026-10-24

## Qué cambia para el operador

### Navegación centrada en el trabajo
La estación se organiza en cinco espacios: **Inicio, Diseñar, Preparar, En Vivo, Biblioteca**. El Inicio incluye una guía opcional que se puede recuperar en cualquier momento.

### Diseñar (Content Studio)
- Lienzo con más espacio útil y controles de fondo/guías que se despliegan cuando hacen falta.
- Inspector con herramientas principales y avanzadas sin perder sus capacidades.
- Historial de versiones agrupado, con guardado deliberado de snapshots.
- Estado editorial claramente separado: **Guardar versión → Publicar diseño → Gestionar desde En Vivo**.
- Ir a En Vivo conserva la selección específica; no activa ningún elemento por sí solo.

### En Vivo
- Selector de escenas cercano a la cabecera operacional y antes de Preview/Program.
- Preview/Program esquemáticos compactos por defecto y ampliables. **No son monitores de video real.**
- Transiciones detectadas desde OBS y destino explícito hacia Program.
- Gráficas en una cuadrícula de ancho completo; buscador por nombre y filtros Todas / En Program / Por revisar.
- Botones individuales **Mostrar/Ocultar de Program** y ruta contextual para reparar vínculos OBS.
- Estado de protección, advertencias de escenas y acciones de emergencia más fáciles de comprender.
- La cámara virtual OBS activa no es sinónimo de StreamYard transmitiendo.

### Comportamientos existentes que se conservan
- OBS Studio, WebSocket v5 y Virtual Camera.
- URLs y renderizado de Browser Sources.
- Publicación manual separada del borrador y de la emisión.
- Snapshots intencionales y recuperación solo al borrador.
- Animaciones Motion y acciones de emergencia.

## Compatibilidad
Windows x64 con Node.js LTS para compilación; instalador Electron NSIS y variante portable de Windows. La aplicación sigue utilizando el puerto local 3000 y los datos de `%APPDATA%\STDQ OBS Master`. StreamYard recibe la cámara virtual de OBS externamente.

## Limitaciones conocidas antes de salir a producción
- La versión candidata comparte hoy la identificación de la versión RC1 anterior, por lo que **NO debe instalarse sobre una estación activa sin la decisión de versión y un respaldo**.
- No existe en la V4.2 monitoreo nativo de video Preview/Program dentro de OBS MASTER: las pantallas son esquemáticas.
- No hay integración de transmisión directa con StreamYard.
- La compilación y pruebas reales en Windows, ensayo OBS, respaldo verificado y aprobación operativa siguen pendientes hasta contar con sus resultados.
- El instalador puede mostrar advertencias de SmartScreen al no estar firmado digitalmente. No distribuir a público general sin evaluar firma y políticas de instalación.

## Cómo obtener el candidato
Sigue `PLAN_LANZAMIENTO_UX_V42.md`, y ejecuta `PREPARAR_CANDIDATO_UX_V42_WINDOWS.bat` en un clon limpio de la rama. El script de empaquetado no instala ni publica la app; tras un build exitoso, deja Setup, Portable y manifiesto SHA-256 en `desktop-app/release`.

## Criterio para anunciar el lanzamiento
Anunciar como **versión final** solo cuando QA automático, pruebas OBS/StreamYard de ensayo, backup/rollback y conformidad del Director Técnico estén documentados; entonces coordinar versión diferenciada y promoción de PR #8 a `main`.
