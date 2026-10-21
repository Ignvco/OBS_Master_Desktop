# RC5H — HTML Motion: captura optimizada de gráficas con transparencia

**Estado:** experimento pendiente de ejecutar en el Windows del usuario. Rama `v5-html-motion`, basada en RC5M (`v5-monitor-async`). RC5M tiene ~29,8 FPS de Unity Camera y ~15 FPS medidos en ambos monitores, con percepción mejorada confirmada por el usuario. **No mezclar `main` ni `v5-native` automáticamente.**

## Hallazgo del motor

`desktop-app/lab/direct_graphics.py` mantiene dos Playwright Edge independientes, capturando el escenario de **1920×1080 CSS** con PNG transparente; después decodifica imagen 1920×1080 y reduce a **1280×720** mediante OpenCV antes del blend en video Unity.

Mediciones reales RC5M: screenshot HTML Program ~160–380 ms, Preview ~190–366 ms para los últimos frames; contadores Program sumaron 30–40 capturas cada ~10 s (~3–4/s) y Preview tenía una espera adicional fija de **750 ms** al final de cada ciclo. Por eso los monitores MJPEG de 15 FPS muestran webcam fluida pero las *animaciones HTML* no necesariamente actualizan a 15 FPS.

## Experimento RC5H (opt-in)

En vez de alterar los estilos, diseños o el árbol React de Content Studio, se configura **solo en el navegador headless Playwright**:

- `STDQ_DIRECT_HTML_CAPTURE=720`: viewport CSS **se conserva 1920×1080**, mismo tamaño, posiciones y breakpoints que antes; `device_scale_factor=2/3`, `page.screenshot(scale="device",omit_background=True)` pide imagen física de **1280×720**.
- Se evita PNG 1920×1080 y su posterior reescalado en OpenCV. `compile_overlay` mantiene la composición con alpha, máscaras y componentes habituales.
- Se conserva el aislamiento de motores Preview/Program y los marcadores de revisión/Takes **antes y después de cada screenshot**. Take/Cut, Unity Camera, dos workers MJPEG, datos publicados, borradores, Content Studio y salida a StreamYard no se modifican.
- Modo original permanece como fallback `STDQ_DIRECT_HTML_CAPTURE=1080` **sin cambiar los intervalos anteriores**: Program 100ms mínimo, Preview 750ms mínimo.
- En modo experimental 720, Program apunta a intervalo mínimo **100 ms** y Preview a **125 ms** (no son FPS garantizados: si un screenshot tarda más, mandará la duración real).
- Nuevos logs `HTML program/preview: CSS viewport=1920x1080 DPR=0.6667 ...` y `STDQ_PERF screenshot_program=...ms screenshot_preview=...ms capture_preview_total=...`.
- Si Chrome/Edge no soporta exactamente DPR fraccional, el motor **rechaza la captura inesperada**, no la redimensiona silenciosamente. El BAT de Windows ejecuta antes un smoke test real de Edge validando que el viewport CSS sigue en 1920, que PNG es 720p con canal alpha y que las posiciones son las mismas.

**Limitación:** una rasterización final a 720p puede cambiar mínimamente el antialiasing de bordes y texto frente al anterior screenshot 1080p reducido. No prometer fidelidad idéntica sin comparación visual de los diseños reales. El sistema de animaciones sigue ejecutándose a la misma velocidad lógica, pero solo se pueden observar tantos pasos por segundo como capturas completas produzca Playwright.

## Ejecutar en Windows 10 fuera de emisión pública

1. Si no se ha hecho en RC5M: preparar Banner + Lower Third en Preview, verificar que StreamYard/Program no cambian y realizar dos Take/Cut en `OBS-Master-v5-monitor-async`, comprobando ambos ACK y aislamiento. Detener y cerrar por completo desde bandeja.
2. Hacer respaldo de los datos de desarrollo antes de utilizar otra rama (ambos clones comparten `%APPDATA%\STDQ OBS Master V5 Native Dev\.stdq-runtime`). Conservar ambos proyectos anteriores sin modificaciones.
3. En CMD clonar esta rama a **otra carpeta**:
   ```bat
   cd /d "%USERPROFILE%\Desktop"
   git clone --branch v5-html-motion --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-html-motion
   cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-motion"
   INICIAR_RC5_HTML_MOTION_WINDOWS.bat
   ```
4. Si falla test de Playwright/alpha/dimensiones, **no inicia** RC5H; copiar el error. No instalar drivers, no mover nada a main.
5. En la bandeja iniciar Unity Camera; abrir StreamYard con `Unity Video Capture`. Deben mostrarse `HTML program/preview: CSS viewport=1920x1080 DPR=0.6667`, y después `Salida/STDQ_MONITOR/STDQ_PERF`.
6. Probar con las gráficas reales más exigentes: Banner, Lower Third, logos con transparencias, texto grande, animaciones de entrada/salida, capas y máscaras. Comparar la **suavidad de movimientos de las gráficas** contra RC5M y verificar contorno/tipografía, sin confundir con FPS de webcam.
7. 60–90 s iniciales de salida; aportar mínimo 5 registros `Salida`, `STDQ_MONITOR` y `STDQ_PERF`, especialmente `html_program`, `html_preview`, `screenshot_program`, `screenshot_preview` y `capture_preview_total`. Luego dos Take/Cut y confirmar en StreamYard.
8. Para regresar a RC5M, cerrar OBS MASTER y Unity completamente y arrancar el proyecto anterior `OBS-Master-v5-monitor-async\INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat`. No trasladar el frontend `dist` a otras carpetas.

## Criterios de aceptación

- Misma composición gráfica y máscaras (sin cambios evidentes de pixelación, bordes, tipografía o z-order).
- Sin contenido preparado en Preview filtrándose a Program antes de Take; ACK y orden original correctos.
- Unity/StreamYard conservan ~29–30 FPS reales (sin caída sostenida a ~25 o menos).
- Preview/Program internos siguen ~15 FPS, sin backlog/error en sus workers.
- `html_program/html_preview` y/o tiempo de screenshot se reducen de manera repetible; animaciones reales se aprecian más fluidas.
- Inicio y cierre limpio 5 veces + prueba de >=30 minutos antes de proponer merge.
- Si rendimiento o fidelidad no mejoran, **descartar experimento**; mantener RC5M.

**Esta fase NO incorpora transiciones animadas entre Preview/Program.** El Take nativo sigue siendo Cut, sin reemplazar las animaciones propias de las gráficas.
