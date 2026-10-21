> **Actualización v4.2 RC1 — Fase 1 + Fase 2 / revisión En Vivo e Historial.** Consultar `VALIDACION_V42_WINDOWS.md` y `PROBAR_V42_WINDOWS.bat`. Las publicaciones y recuperaciones ya no generan snapshots. Sin integraciones/exportaciones adicionales.

> **Actualización 4.1 RC1 (Fases 1 y 2):** consultar `LEEME_V41_FASES_1_Y_2.md` y `PROBAR_V41_FASES_1_2_WINDOWS.bat`. No se ha implementado ninguna integración/exportación adicional.

> Actualización V3.9 RC2: consultar `LEEME_MOTOR_CAPAS_UNIFICADAS_V39_RC2.md` para instalación y pruebas.

# Si Te Dijera Que? — OBS MASTER V4.2 RC1

Estación visual React 19 + TypeScript + Vite para controlar OBS Studio mediante OBS WebSocket v5.

**Equipo:** Windows (OBS / EMEET / cámara virtual / StreamYard). La Mac opera el audio por separado.

## Windows (Node.js 22 LTS)

1. `INSTALAR_WINDOWS.bat` — instala las dependencias.
2. `INICIAR_WINDOWS.bat` — inicia el panel en `http://localhost:3000`.
3. Activa el servidor WebSocket de OBS (puerto 4455), luego conecta en el panel.
4. Agrega las gráficas como fuentes **Navegador**, por ejemplo:
   - `http://localhost:3000/?overlay=lower-third`
   - `http://localhost:3000/?overlay=banner`
   - `http://localhost:3000/?overlay=question`
   - `http://localhost:3000/?overlay=waiting`
   - `http://localhost:3000/?overlay=break`
   - `http://localhost:3000/?overlay=outro`
5. Configura cada Browser Source a 1920×1080 y ubícala por encima de la cámara.
6. Desde OBS MASTER inicia OBS Virtual Camera y selecciona esa cámara en StreamYard. La transmisión final se inicia desde StreamYard.

## Scripts

- `npm ci`: instalar dependencias.
- `npm run dev`: iniciar la estación.
- `npm run lint`: TypeScript sin emitir archivos.
- `npm run build`: build Vite.
- `npm run test:core`: pruebas Node.

## Estado sincronizado

El servicio local incorporado guarda contenido/episodio/cuenta regresiva en `.stdq-runtime/station.json` y envía los cambios a OBS Browser Source mediante SSE. **No copies este archivo a repositorios públicos ni compartas tu contraseña OBS**. El archivo se excluye del ZIP inicial para respetar tus datos.

Consulta `GUIA_ACTUALIZACION_V302.md` para cambios, precauciones y pruebas de emisión.

## Content Studio — edición por capas

El parche **Editor por Capas** habilita manipulación individual de titulares, etiquetas, elementos originales y capas adicionales de texto, imagen y forma. Consulta `GUIA_EDITOR_POR_CAPAS.md`. Las URLs OBS existentes siguen iguales. No edites gráficas visibles durante una emisión sin una escena de ensayo.

## Biblioteca funcional (actualización Layer Studio)

Consulta [GUIA_BIBLIOTECA_FUNCIONAL.md](GUIA_BIBLIOTECA_FUNCIONAL.md) para instalar y operar el nuevo catálogo de episodios y medios. Los datos de la biblioteca se guardan en `.stdq-runtime/library.json` y los archivos en `.stdq-runtime/media/`. Nunca borres esa carpeta al actualizar.
