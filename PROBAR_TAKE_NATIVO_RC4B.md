# OBS MASTER v5-native — RC4B: TAKE NATIVO (CUT)

**Estado:** código implementado en rama `v5-native`. Las verificaciones posteriores a este commit **no han sido ejecutadas en Windows**. No fusionar con `main` ni usar en emisión pública todavía.

## Alcance del hito

El botón original **TAKE · CUT** (monitor verde En Vivo) y el botón **Ejecutar CUT a Program** (sección original de transiciones) ahora solicitan un corte nativo a Unity Camera. No se añadió nueva pantalla ni un segundo modo.

1. `GET /api/direct/preview` devuelve la selección y su revisión, separadas de Program.
2. El panel envía `POST /api/direct/take` con `{type:"Cut",expectedRevision}`, mismo origen HTTP.
3. El servidor valida el motor activo y bloquea escrituras de estación/publicación y preparación mientras el Take esté pendiente.
4. Electron envía `TAKE <revision> <id>` mediante stdin del proceso Python **ya supervisado**.
5. El renderizador Playwright de Preview captura cada fotograma junto a su atributo de revisión, verificándolo antes/después de screenshot.
6. El hilo de salida de Unity Capture rechaza revisiones no capturadas o superposiciones de Take; toma la composición Preview validada e invoca `cam.send()`.
7. **Después de enviar el primer fotograma de esa composición**, Python responde `STDQ_TAKE_ACK`. El servidor recién entonces actualiza conjuntamente los flags `visibleInOBS` de los diseños publicados, sin cambiar contenido, borradores ni revisiones.
8. Program recibe el nuevo estado por SSE y compone desde el renderer habitual. El motor conserva temporalmente la composición tomada hasta detectar que Program ha capturado el identificador de Take correspondiente.
9. Ante error: la API solicita `ROLLBACK <id>` y devuelve un error. **La reversión se solicita, no se promete como éxito hasta recibir ACK**. Si un fallo sucede después del primer fotograma, ese fotograma podría haber salido; verificar siempre StreamYard.

### Límites reales

- RC4B incluye **corte inmediato (Cut)**. No incluye Fade, Swipe, Stinger ni otras transiciones animadas; esas opciones no se presentarán como disponibles en modo Direct.
- El ACK prueba la llamada exitosa a `cam.send()`, **no confirma recepción final en StreamYard**.
- El corte usa inicialmente un fotograma estático del Preview preparado; Program continúa animando los componentes publicados una vez actualizado. La cadencia de cuadros, latencia y transición sin artefactos requieren validación.
- `visibleInOBS` se conserva como nombre de campo heredado para compatibilidad con datos guardados; **no implica que OBS Studio esté operando**.
- La gestión nativa de escenas, configuración de cámaras, Motion/controles de Program, desinstalación OBS WebSocket y empaquetado independiente de Python siguen pendientes.
- Nunca hacer Cut si el monitor Program, el monitor Preview o la salida a StreamYard no están en buen estado.

## Prueba controlada en Windows 10 (SIN programa público al aire)

1. Cierra completamente OBS MASTER desde la bandeja y detén Unity Camera. Mantén la v4.2 estable separada.
2. En CMD:
   ```bat
   cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-native"
   git pull origin v5-native
   INICIAR_RC4A_VERIFICADO_WINDOWS.bat
   ```
   El BAT verifica TypeScript, tests, Vite, servidor Electron, sintaxis Python y contiene el marcador `Ejecutar CUT a Program` en el JS servido.
3. En la misma app, enciende Unity Camera desde la bandeja, verifica ambos monitores y la señal `Unity Video Capture` en StreamYard.
4. En las tarjetas de En Vivo, pulsa **Preparar Preview** para Banner y Lower Third. Antes del Take, asegúrate de que **solo el monitor verde cambió**.
5. Pulsa **TAKE · CUT** una vez. Mientras espera, el botón se deshabilita. Espera el mensaje `Cut confirmado por Unity Camera · fotograma N` (o un error).
6. **Verifica visualmente** que Program y StreamYard muestren Banner y Lower Third. Si hay error, no presiones Take de nuevo sin comprobar StreamYard.
7. Retira Banner solo de Preview. Antes de otro Take, verifica que Program y StreamYard todavía lo tienen. Pulsa Take y confirma que Program/StreamYard retiran Banner pero conservan Lower Third.
8. Repite una vez con Preview vacío **solo después de aceptar la confirmación** para probar Cut a webcam sin gráficas.
9. Verifica que `Content Studio` conserva borradores e historial y que ninguna publicación apareció automáticamente como una versión guardada.
10. Detén y reinicia Unity Camera desde la bandeja y comprueba que los últimos flags Program se restauran, que no hay errores Playwright y que los controles siguen activos.

## Diagnóstico en caso de error

- `Motor rechazó Take: PREVIEW_NOT_READY`: espera 2–3 segundos tras preparar Preview antes de pulsar Cut; la imagen puede estar visible en el monitor pero su revisión aún no estar confirmada por el capturador.
- `El motor no confirmó ... dentro del plazo`: deja de emitir, confirma señal en StreamYard y comparte el log. La API intentará Rollback.
- `Preview cambió`: había otra operación durante el Take; actualiza y vuelve a preparar, solo después de comprobar Program.
- Botón antiguo `Take nativo pendiente` o `Transición a Program` con Unity activa: Electron está sirviendo una compilación vieja. Ejecuta el BAT verificado y el diagnóstico de RC4A.
- `npm run lint` / `npm run test:core` / `npm run build` / `npm run desktop:server` / `py_compile` fallan: **no iniciar RC4B**; comparte los errores exactos.

## Archivos principales

- `src/server/stationBridge.ts`: transacción exclusiva y commit operativo posterior a ACK.
- `desktop-app/server.ts`: API mismo origen `/api/direct/take`, validación Cut, rollback.
- `desktop-app/main.cjs`: interfaz Electron→motor.
- `desktop-app/direct-process.cjs`: envío de comandos y asociación de ACK/NACK.
- `desktop-app/lab/direct_graphics.py`: toma revisiones de Preview, envía a Unity, confirma y restaura cuando falla.
- `src/components/overlays/DirectCompositeRenderer.tsx`: marcadores de revisión Preview y Take Program.
- `src/services/sharedStation.ts`: campo operativo `directTakeId` propagado por SSE.
- `src/App.tsx`: controlador original envía `Cut` directo con resultado explícito.
- `src/components/spaces/BroadcastControlSpace.tsx`: controles originales, solo Cut real.
- `src/tests/desktopServer.test.ts`: puertas de seguridad, exclusión de escrituras y ACK/rollback simulados en tests.
- `INICIAR_RC4A_VERIFICADO_WINDOWS.bat`: construcción reproducible y py_compile del motor.

**Importante:** no se realizó aquí prueba física con tu webcam, Unity Capture y StreamYard; la aprobación real requiere el ensayo guiado en tu Windows.
