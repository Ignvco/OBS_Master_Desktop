# OBS MASTER v5 — RC4A: Preview REAL e independiente

**Estado:** Código implementado en `v5-native`. **Aún no compilado ni probado con Unity en Windows** después de RC3.

## Implementación

- `src/server/directPreviewStore.ts`: archivo independiente `direct-preview.json`; selección de hasta 32 gráficas publicadas; escritura atómica y revisión optimista. No altera `station.json`, diseños, versiones, Program ni StreamYard.
- `src/server/stationBridge.ts`: `GET /api/direct/preview` y `POST /api/direct/preview`; validación local, Origin obligatorio para POST, JSON y control de revisión.
- `src/utils/directComposition.ts`: composición de Preview toma las gráficas publicadas seleccionadas **aunque estén ocultas en Program**, sin exponer borradores.
- `src/App.tsx` y `src/components/overlays/DirectCompositeRenderer.tsx`: nueva URL interna `/?overlay=direct-preview` con renderer original y actualización periódica de selección, independiente de `direct-program`.
- `desktop-app/lab/direct_graphics.py`: segundo trabajador Playwright de baja frecuencia (`~0.75 s` de intervalo mínimo). Ambos reciben la misma webcam física; solo el canal Program invoca `cam.send()` sobre Unity Capture. Preview compone su overlay separado para monitoreo.
- `desktop-app/lab/direct_monitor.py` y `desktop-app/server.ts`: segundo MJPEG tokenizado y proxied por la misma ruta local y protección de origen (`/api/direct/preview.mjpg`).
- `src/components/spaces/BroadcastControlSpace.tsx`: sustituye la representación esquemática del monitor Preview **en su sitio original**, sin cambiar composición de interfaz. El botón Take original se muestra explícitamente como pendiente y bloqueado mientras el motor nativo está activo (todavía no hay transición con ACK del motor).
- `src/tests/directComposition.test.ts`, `src/tests/desktopServer.test.ts`: validan aislamiento de selección, protección por revisión, no publicación de borradores ni cambios a Program.
- `PROBAR_DIRECT_PREVIEW_RC4A.ps1`: activa exclusivamente en Preview Banner + Lower Third y, al terminar, restaura la preparación previa; advierte si cambió Program.

## Límite explícito

**RC4A no implementa Take nativo, transiciones, ni cambios de escena en Program.** No se debe usar el botón de OBS Studio como sustituto, ni inferir que Preview afecta la salida. Esta fase valida un Preview real físicamente independiente del Program, condición indispensable antes de programar un `take` atómico y confirmado.

El renderizado de dos navegadores Playwright puede aumentar consumo de CPU/RAM y comprometer FPS; comparar con RC3 antes de aceptar. Los FPS principales configurados siguen siendo 30; el monitor Preview se actualiza por separado y **no** garantiza 30 FPS.

## Prueba Windows — no emitir públicamente

1. Salir de Electron v5 y detener Unity Camera en bandeja.
2. `git pull origin v5-native`.
3. `npm run lint`, `npm run test:core`, `npm run build`, `npm run desktop:server`. Si falla alguno, detener prueba.
4. Copiar `dist` a `desktop-app/dist`; `cd desktop-app; npm start`.
5. Iniciar Unity Camera desde la bandeja. Comprobar que los monitores Preview y Program contienen webcam real.
6. En otra consola, desde el root ejecutar `powershell -ExecutionPolicy Bypass -File .\\PROBAR_DIRECT_PREVIEW_RC4A.ps1`.
7. **Preview debe mostrar Banner + Lower Third**. **Program y StreamYard deben conservar exactamente su composición previa**, sin los cambios de Preview. Si Programa cambia, es una regresión crítica.
8. ENTER restaura la preparación previa; verificar Start/Stop de Unity sin procesos huérfanos y sin errores de Playwright.
9. Comparar fluidez contra RC3 (StreamYard > monitor Preview). No aprobar si hay degradación sensible.
10. Recopilar logs y capturas de pantalla de ambos monitores si falla algo.

**Siguiente hito RC4B:** snapshots persistentes para escenas nativas + `take` atómico con confirmación real y rollback; conectar al controlador del Panel En Vivo y controles de publicación sin OBS WebSocket. No modificar `main` antes de pruebas completas.


## RC4A hotfix — Preparación desde En Vivo (2026-10-21)

El primer RC4A inicializaba `direct-preview.json` con `ids:[]`; abrir Electron por sí solo **no** añadía gráficas a Preview. El script PowerShell prepara y deshace selecciones solo mientras está en espera.

Ahora `BroadcastControlSpace.tsx`, **en el mismo panel aprobado**, incluye el botón `Preparar Preview` junto a Editar/Detalles/Motion de cada gráfica publicada. Consulta revisión vigente del servidor y hace POST de la nueva selección. Si existe un conflicto o no hay publicación responde con error visible en la misma sección. El botón `✓ En Preview` retira exclusivamente del ensayo. Los controles OBS todavía no migrados no se habilitan falsamente por haber iniciado Unity Camera.

### Prueba manual sin PowerShell adicional

1. Cerrar Electron y Unity Camera; desde **CMD** en el clon `v5-native` actualizar Git y correr lint/tests/build/desktop:server; si falla algún paso, detener.
2. Copiar la carpeta `dist` nueva a `desktop-app/dist` y ejecutar `npm start` desde `desktop-app`.
3. Encender Unity Camera en bandeja; entrar en **En Vivo**.
4. En tarjetas Banner y Lower Third, pulsar **Preparar Preview**. La etiqueta debe cambiar a **✓ En Preview**.
5. El monitor verde debe mostrar ambas gráficas; Program/StreamYard no deben cambiar.
6. Pulsar nuevamente para retirar una sola de Preview; confirmar que desaparece del monitor verde.
7. Consultar `http://127.0.0.1:3000/api/direct/preview` para ver el array `ids` realmente persistido.
8. Si `ids` contiene los gráficos pero siguen sin aparecer, revisar el worker Playwright Preview, la captura PNG con alfa y el proxy `/api/direct/preview.mjpg`. No dar el problema por resuelto sin prueba de video real.

El Take nativo y las escenas siguen pendientes; no usar como estación de emisión pública.
