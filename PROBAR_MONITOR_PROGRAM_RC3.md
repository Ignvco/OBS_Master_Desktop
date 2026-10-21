# OBS MASTER 5.0 — Prueba RC3: MONITOR PROGRAM REAL

## Alcance comprobable en Windows 10

Este hito incorpora una **señal de monitoreo en el recuadro Program del Panel En Vivo original**, capturada de fotogramas que el proceso Direct acaba de enviar a Unity Capture. No agrega paneles ni modos paralelos.

- Unity Camera sigue enviando el video principal a StreamYard a **1280 × 720 / 30 FPS configurados**.
- Para no competir con la salida, el monitor visual de Electron usa JPEG **640 × 360 a un máximo aproximado de 7,5 FPS**. Esa tasa NO es la tasa de video entregada a StreamYard.
- El monitor MJPEG se produce dentro del proceso Python, escucha solo 127.0.0.1:31311, exige token aleatorio por inicio y Electron lo reenvía solo para llamadas same-origin.
- `/api/direct/status` sigue describiendo solamente el estado del proceso supervisor. No prueba recepción en StreamYard.
- El Panel En Vivo ya muestra ese monitor en la superficie existente de Program. **Preview todavía no tiene video independiente y se identifica como pendiente**. Las operaciones de escenas, gráficas, transición y Configuración siguen conectadas a OBS hasta la próxima fase: **NO enviar al aire con RC3**.

## Pasos de actualización

0. Respaldar contenido, no sustituir instalación v4.2. Detener Unity Camera desde la bandeja y salir completamente de OBS MASTER V5 Native Dev.
1. En PowerShell, desde `%USERPROFILE%\Desktop\OBS-Master-v5-native`: `git pull origin v5-native`.
2. Ejecutar `npm run lint`, `npm run test:core`, `npm run build`, `npm run desktop:server`.
3. Eliminar `desktop-app/dist` antigua y copiar `dist` nueva dentro de `desktop-app/dist`. (La compilación TypeScript genera `desktop-app/compiled`).
4. Desde `desktop-app`, ejecutar `npm start`.
5. Abrir **En Vivo**; desde la bandeja iniciar **Unity Camera (laboratorio)**.
6. Verificar que el recuadro **Program** cambia de esquemático a imagen real. Abrir StreamYard y comprobar que `Unity Video Capture` entrega la MISMA composición, con mayor cadencia que el monitor.
7. Ejecutar `PROBAR_DIRECT_COMPOSICION_WINDOWS.ps1` desde otra consola para activar temporalmente Banner + Lower Third; comprobar ambos en monitor Program y StreamYard; Enter restaura estados.
8. Detener/reiniciar cámara desde la bandeja. El monitor debe actualizarse sin dejar procesos Python ni Edge residuales del motor.

## Bloqueadores y evaluación

**No aprobamos esta fase simplemente porque compile.** Hay que comprobar visualmente la señal y el cierre del proceso en Windows.

- Si el recuadro informa "Monitor no disponible", usar **Reintentar monitor** y comprobar `http://127.0.0.1:3000/api/direct/status`, el proceso Python y las dependencias.
- Si el video principal se entrecorta al activar el monitor, guardar los FPS mostrados en salida del motor y comparar antes/después. Reducir o desactivar monitor de prueba; no usar en transmisión.
- Python, Playwright, OpenCV y Unity Capture siguen dependiendo de los componentes validados instalados en Windows; aún no existe un instalador autosuficiente.
- El marco Program muestra exactamente la composición producida por el motor **con muestreo reducido** y no una reproducción de cámara virtual consumida por StreamYard. El receptor final se valida visualmente en StreamYard.
- Necesitamos motor de escenas con snapshots Preview/Program, acciones del mismo panel y configuración nativa de cámara, antes de retirar OBS WebSocket.

## Próxima fase (RC4)

Almacenar snapshots independientes de Preview y Program; confirmar comandos de `take` y `transition` con el compositor; servir ambas señales como fotogramas reales, no duplicar Program en Preview; preservar edición/publicación/historial y proteger estado Al Aire.
