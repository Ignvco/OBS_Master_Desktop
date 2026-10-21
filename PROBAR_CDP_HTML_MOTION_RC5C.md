# RC5C — HTML Motion: benchmark CDP sin pérdida de transparencias

**Estado:** rama experimental `v5-html-cdp`, basada en `v5-html-motion`. Esta rama no modifica `main`, `v5-native`, `v5-perf`, `v5-monitor-async` ni `v5-html-motion`.

## Problema real confirmado (Windows 10, 21/oct/2026)

El usuario reporta: «Se nota que cambió, pero aún falta; se nota con la cinta en movimiento». Registro del motor en RC5H:

- Unity Camera: 27,8 / 30,1 / 29,3 / 29,7 / 26,8 FPS en cinco ventanas.
- Monitores Program/Preview: ~15 FPS después de arranque, `errors=0`, `dropped=0`.
- Capturas HTML Program acumuladas: 69, 126, 177, 223, 261; intervalos posteriores de ~57, 51, 46, 38 capturas por 10s (aproximadamente 3,8–5,7 fps), con duplicación de posiciones animadas en cuadros Unity.
- Tiempo de screenshot HTML: `screenshot_program` 119 / 125,5 / 132,6 / 155,8 / 139,8 ms; `screenshot_preview` 102,9 / 112,3 / 148,6 / 160,2 / 131,8 ms. El ciclo HTML total cuesta todavía ~147–255ms.
- RC5H 720p consiguió una mejora medible respecto de PNG 1080p+resize, pero no basta para cinta de movimiento continuo a ~15–30 pasos de animación/s.

**Requisito crítico:** conservar CSS 1920×1080, Motion/react real, máscara/translucidez PNG (incluyendo alfa parcial), y semántica Take/Cut transaccional sin contaminación Preview→Program. No aplicar chroma keys, fondo negro, grabación de pantalla ni cambiar componentes a proxies decorativos.

## Experimento opt-in de captura directa CDP

`desktop-app/lab/direct_html_capture.py` implementa dos backends compatibles de captura por demanda:
- `playwright` **original y predeterminado** (Playwright `page.screenshot`, PNG transparente y escala 720p).
- `cdp` experimental: sesión DevTools por página, `Emulation.setDefaultBackgroundColorOverride` para fondo realmente transparente, `Page.captureScreenshot` en PNG con `fromSurface=true`, `captureBeyondViewport=false` y `optimizeForSpeed=true`. Devuelve bytes PNG iguales a los esperados por la composición existente.

El marcador `data-direct-preview-revision` o `data-direct-take-id` se lee **antes y después del screenshot**, como en el motor validado. Ni cola de Take, ni ACK tras Unity, ni aislamiento de estados, ni trama HD se modifican.

**Por qué NO usar CDP screencast aquí:** existen informes de que `Page.startScreencast` produce un fondo negro opaco aunque `Page.captureScreenshot` pueda preservar alpha. En emisión de overlays eso sería una regresión grave. Esta rama **no usa screencast** y no afirma que el protocolo CDP sea necesariamente más rápido sin benchmark del navegador instalado.

**Validación por defecto, antes de arrancar Unity:**
- `test_direct_html_cdp.py` lanza Microsoft Edge headless en Windows sin webcam.
- Renderiza un escenario 1920×1080 con 2 rectángulos sólido/translúcido, fondo transparente y cinta horizontal animada con CSS.
- Comprueba para Playwright y CDP: PNG verdadero **1280×720×4 canales**, píxel de fondo con `alpha=0`, sólido alpha 255, translúcido alpha ≈128, posiciones esperadas y variación real de los píxeles de la cinta entre capturas.
- Imprime `RC5C_BENCH engine=playwright mean=...ms ...` y `RC5C_BENCH engine=cdp mean=...ms ...`. **Si falla CDP, el BAT no arranca la app experimental**. Nunca se acepta una imagen opaca sin avisar.
- Además, `STDQ_HTML program=...fps preview=...fps | motor=cdp` muestra los FPS **reales de las animaciones** independientemente de Unity y MJPEG monitores.

## Protocolo Windows (no probar durante programa público)

1. Detener Unity Camera, cerrar OBS MASTER desde bandeja y liberar cámara de otras aplicaciones. Mantener intacta la carpeta ya funcional `OBS-Master-v5-monitor-async`. Respaldar previamente los datos de desarrollo del perfil compartido:
   `%APPDATA%\STDQ OBS Master V5 Native Dev\.stdq-runtime`.
2. Clonar carpeta **separada**:
   ```bat
   cd /d "%USERPROFILE%\Desktop"
   git clone --branch v5-html-cdp --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-html-cdp
   cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-cdp"
   INICIAR_RC5_CDP_MOTION_WINDOWS.bat
   ```
3. El iniciador ejecuta `py_compile`, el benchmark Edge comparando transparencia y movimiento Playwright vs CDP, tests RC5H, test de monitores asíncronos/compilación y arranca Electron **solo si todo pasa**. Activará el backend `cdp` para ambas páginas con `STDQ_DIRECT_HTML_CAPTURE=720`. Unity sigue 1280×720/30 MJPG-last, monitor Preview/Program siguen 15fps.
4. Anotar `RC5C_BENCH` de ambos métodos. En el motor, verificar `HTML program ... captura=cdp`, `Salida`, `STDQ_MONITOR`, `STDQ_HTML`, `STDQ_PERF screenshot_program/screenshot_preview`. Medir 6-10 ventanas de 10s, con cinta en movimiento.
5. Comparar **la cinta animada real** en StreamYard, Preview y Program; comprobar texto, logo, transparencia, máscaras, bordes, capas. No asumir fidelidad visual por prueba sintética. Asegurarse de que el componente no cambia al prepararlo y no sale al aire antes de Take.
6. Hacer dos Take/Cut con contenidos diferentes y comprobar ACKs; revisar que Preview aislado no se filtra ni antes ni después de transición.
7. Vigilar que Unity permanezca ~29–30fps, los monitores ~15fps y **STDQ_HTML** suba significativamente respecto de las ~4–6 capturas/s previas. El nuevo motor CDP no tiene obligación de mejorar FPS en todos los PCs; los datos deciden.
8. Si los tests no pasan, no arrancar. Si hay pérdida de fidelidad, tirones o error durante transmisión de prueba, detener y regresar al clon probado `OBS-Master-v5-monitor-async` con `INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat`.

## Criterios para merge

- Pérdida de transparencia y máscara **cero** en condiciones reales.
- Preview/Program y Unity mantienen sus FPS medidos.
- Mejora sostenida del número de posiciones distintas de la cinta y FPS reales de HTML con datos, no solo sensación.
- Dos Take/Cut validados en esta misma build, además de 30 min sin colapso, 5 reinicios ordenados.
- Si CDP no mejora suficiente o la transparencia falla, **no fusionar**: evaluar otro pipeline de renderización de movimiento, sin sacrificar compatibilidad con los diseños.

## Primer test RC5C en Windows — fallo de dimensiones, corrección aplicada

**Log real del usuario:**
```text
RC5C_BENCH engine=playwright mean=129.6ms min=92.4ms max=175.1ms frames=12
CDP: PNG esperado (720, 1280, 4), recibido (1080, 1920, 4)
FAILED ... Por seguridad, NO iniciamos Unity Camera
```

Este fallo es **de dimensiones de la captura directa CDP**; no demuestra por sí solo pérdida de transparencia ni lentitud relativa, porque el test se detuvo en el chequeo inicial de tamaño. Playwright clásico pasó, incluidos píxeles animados. El arranque protegido actuó correctamente y RC5M permanece intacto.

**Corrección experimental:** `direct_html_capture.py` ahora envía `Page.captureScreenshot.clip={x:0,y:0,width:1920,height:1080,scale:devicePixelRatio}` (en lugar de omitir clip) para capturar **todo el lienzo**, no un recorte izquierdo, y calibra hasta una segunda captura si la versión local de Edge devuelve un tamaño inesperado. Lee ancho/alto del encabezado PNG y **rechaza** dimensiones erróneas: nunca pone a salir al aire una imagen sin tamaño correcto, ni disimula el error redimensionando automáticamente en OpenCV. Conserva `Emulation.setDefaultBackgroundColorOverride` transparente.

**Prueba ampliada:** además de fondo alpha 0, gráfico sólido y capa semitransparente, se añadió un elemento en el borde **derecho/inferior** de la composición para detectar recortes disfrazados de escalado. Se prueba también el encabezado binario PNG. Ninguna prueba se ha ejecutado todavía en Windows después de este arreglo.

### Reintentar sin clonar otro proyecto

Cerrar completamente Electron y Unity Camera, después ejecutar CMD en el clon ya existente:
```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-cdp"
git pull origin v5-html-cdp
INICIAR_RC5_CDP_MOTION_WINDOWS.bat
```

Aportar `RC5C_BENCH` para Playwright y CDP si pasan; si vuelve a fallar **no intentar iniciar el motor** y copiar el error. El test y el iniciador bloquean el uso de CDP ante fallo. Una comparación con CDP más lento o sin ventaja sustancial no justifica integrarlo: mantener RC5M y evaluar otro pipeline de animación.
