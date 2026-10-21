# OBS MASTER RC5R — recortes HTML inteligentes con Playwright (EXPERIMENTAL)

## Antecedentes verificables

RC5M, confirmado por el usuario Windows 10: **Unity 1280×720 ~29,8 FPS y Preview/Program internos ~15 FPS** gracias a MJPG-last, composición OpenCV optimizada, trabajadores JPEG asíncronos y reloj phase-locked. La mejora visual de los monitores fue confirmada.

RC5H (Playwright PNG de 1280×720 con CSS viewport 1920×1080): capturas HTML ~3,8–5,7 FPS; cinta móvil aún se percibe entrecortada.

RC5C (CDP con clip): ***NO aprobado***. Registro integrado: **Unity 24,0 → 23,3 → 20,2 FPS**, mientras `STDQ_HTML` cae de 6,1 a 4,5 FPS. CDP consume demasiado en esta PC y no soluciona la cinta; PR #6 permanece sin merge.

## Estrategia RC5R

Sin alterar cámara, Unity, Take/Cut, estado publicado ni Content Studio, se explora **Playwright screenshot parcial** como alternativa. El navegador sigue renderizando el escenario CSS editorial de 1920×1080 (DPR=2/3) y PNG alfa de 1280×720, pero si las gráficas ocupan una región localizada captura sólo ese rectángulo, lo sitúa sobre un lienzo transparente completo y entrega a `compile_overlay` exactamente el mismo tipo de RGBA utilizado en RC5M/RC5H.

`desktop-app/lab/direct_html_roi.py`:
- Calcula en el navegador un recuadro que contiene `getBoundingClientRect` de **todas las gráficas actuales y descendientes**, incluyendo transformaciones Motion, máscaras y textos. Este muestreo no altera su DOM, animaciones o z-order.
- Conserva margen de seguridad **144 px CSS** para sombras y movimientos, redondea hacia fuera a múltiplos de 3 CSS (cada 3 CSS equivale exactamente a 2 píxeles en DPR 2/3), limita el clip a los 1920×1080 del stage.
- Si el área recortada ocupa **≥72 % del escenario**, si la geometría es dudosa, hay demasiados elementos o el recorte es inválido: **captura el fotograma completo**. No se pierde contenido deliberadamente por intentar recortar un fullscreen.
- Si no hay ninguna gráfica representada: acepta fotograma transparente sin screenshot, preservando los marcadores de Preview/Take.
- Python recompone las coordenadas en el lienzo de 1280×720 RGBA. Si Playwright retorna un clip incompatible, **reintenta el screenshot completo** para proteger el aire (sin cambiar la salida MJPG).

`direct_graphics.py` mantiene el mismo protocolo de `data-direct-preview-revision` y `data-direct-take-id` antes/después, de modo que una captura iniciada con una revisión no puede aceptarse bajo otra. La activación requiere explícitamente **`STDQ_DIRECT_HTML_ROI=1` y `STDQ_DIRECT_HTML_CAPTURE=720`**. Por defecto todo sigue usando el comportamiento probado de RC5H. No se toca ningún archivo de diseño React.

**Limitación:** Motion y CSS pueden mover contenido durante los ~100ms que tarde el screenshot. El margen grande reduce riesgo de recorte pero no asegura equivalencia 1:1 de todos los efectos (glows extremos, desplazamientos muy rápidos). Las pruebas con tus gráficas reales y la opción de rollback son imprescindibles. Las capturas PNG de pantalla completa aún se usarán para composiciones grandes. No prometer 15 FPS HTML antes del ensayo real.

## Fase 1: ejecutar únicamente benchmark offline en Windows

No requiere Unity, webcam, OBS MASTER ni StreamYard. Clonar una carpeta separada, sin tocar RC5M:

```bat
cd /d "%USERPROFILE%\Desktop"
git clone --branch v5-html-roi --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-html-roi
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-roi"
DIAGNOSTICO_RC5R_HTML_REGION_WINDOWS.bat
```

- El BAT comprueba sintaxis, geometría y ejecuta Edge real con cinta CSS, texto blanco editorial, gradiente, máscara translúcida y fondo transparente.
- La prueba compara en **píxeles** PNG completo y PNG reconstruido desde recorte sobre el mismo escenario estático. Límite de tolerancia: 2 niveles RGB/alpha máximo; alpha fuera debe ser cero; alpha semitransparente conservado.
- Rehabilita movimiento del ticker y mide 10 screenshots completos vs 10 screenshots ROI en el mismo navegador, asegurando posiciones distintas. Muestra:
  ```text
  RC5R_BENCH full_mean=...ms roi_mean=...ms clip=... CSS ticker_changes=...
  Ran 3 tests ... OK
  ```
- La medida **no es un FPS de emisión**; sólo determina si vale la pena abrir la app en modo ROI. En caso de FAIL, no iniciar versión experimental, compartir el error.

## Fase 2: ensayo opcional dentro de OBS MASTER (SOLO tras pasar pruebas)

**Antes**: detener Unity Camera, cerrar OBS MASTER completamente desde bandeja y respaldar `%APPDATA%\STDQ OBS Master V5 Native Dev\.stdq-runtime` (todos los clones V5 comparten ese perfil).

```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-roi"
INICIAR_RC5_HTML_REGION_WINDOWS.bat
```

El BAT vuelve a probar PNG con Edge antes de abrir Electron y activa 720p ROI experimental. Probar fuera de emisión pública.

Medir al menos cinco ventanas `Salida`, `STDQ_MONITOR`, `STDQ_HTML`, `STDQ_PERF`. La nueva línea `STDQ_HTML program=Nfps preview=Nfps ROI=X%/Y%` refleja FPS nuevas imágenes HTML y la proporción del área que la captura está rasterizando. Conservar:
- Unity ~29–30 FPS, no caídas sostenidas a 25 o menos.
- Monitores ~15 FPS sin `dropped` ni `errors`.
- Mayor frecuencia HTML en cinta animada real y percepción visual mejorada.
- Comparación de etiquetas, máscaras, sombras, capas, semitransparencias y esquinas durante animaciones de entrada/salida.
- 2 TAKE/CUT nuevos, sin filtrar Preview a Program, con ACK y comprobación StreamYard.
- Si cumple: 30 min, reinicios limpios y test repetible. Si no: abortar e iniciar el clon RC5M previamente validado.

## No tocar versión estable

Rollback:
```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-monitor-async"
INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat
```

**PR draft** de RC5R hacia `v5-html-motion`; no merge a `v5-monitor-async`, `v5-native` ni `main` sin calidad y mediciones comprobadas en Windows.

## Windows Edge RC5R benchmark real — PASS (21-oct-2026)

Usuario ejecutó `DIAGNOSTICO_RC5R_HTML_REGION_WINDOWS.bat` en Windows 10, sin OBS MASTER ni Unity activos, con los siguientes resultados:

```text
RC5R_BENCH full_mean=149.6ms roi_mean=126.8ms clip=1725x510 CSS ticker_changes=443088
test_edge_full_vs_roi_equal_alpha_and_ticker_motion ... ok
test_empty_and_large_scenes_use_safe_paths ... ok
test_small_graphic_returns_aligned_roi ... ok
Ran 3 tests in 5.357s
OK
```

Reducción media de tiempo de screenshot: **22,8ms (~15,24%)** para ese escenario sintético; **42,42% del área total del stage CSS** (1725×510 / 1920×1080). Las comparaciones de PNG completo y PNG reconstruido con ROI (alfa, máscaras/transparencias, texto y posición) pasaron en el test de referencia de Edge.

**Decisión:** permite un **ensayo integrado privado** y controlado, sin aprobar todavía la optimización. Calcular límites: un screenshot individual de 126,8ms equivale a un techo aritmético de ~7,9 screenshots/s sin coste extra de DOM/evaluación/decode, muy lejos de 15 FPS continuos. `getBoundingClientRect`, solicitud adicional al navegador, PNG decode y composición final pueden reducir o eliminar esa ganancia en el motor completo. Monitorizar `Salida` y `STDQ_HTML` no confundir. Si Unity cae sostenidamente por debajo de ~28fps o HTML no mejora perceptiblemente frente a RC5H, revertir sin fusionar.

**Próximo ensayo del mismo clon**, fuera de emisión pública:
```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-html-roi"
INICIAR_RC5_HTML_REGION_WINDOWS.bat
```

Asegurar backup del perfil V5 compartido. Comprobar que el modo ROI registra `STDQ_HTML program=...fps preview=...fps ROI=...%/...%` y no aparece fallback continuo; medir al menos cinco ventanas `Salida / STDQ_MONITOR / STDQ_HTML / STDQ_PERF` y confirmar visual de la cinta, integridad alfa y Take con StreamYard. No fusionar automáticamente con RC5M.

## RC5R — resultado integrado Windows: RECHAZADO por regresión (21-oct-2026)

El usuario ejecutó `INICIAR_RC5_HTML_REGION_WINDOWS.bat` con `STDQ_DIRECT_HTML_ROI=1` y suministró cuatro ventanas de telemetría:

| Ventana | Unity FPS | HTML Program FPS | HTML Preview FPS | ROI Program/Preview | screenshot Program/Preview |
|---|---:|---:|---:|---|---|
| 1 | 21,7 | 3,4 | 3,4 | 100% / 100% | 205,5 / 189,5 ms |
| 2 | 25,6 | 3,3 | 3,3 | 100% / 100% | 201,3 / 184,7 ms |
| 3 | 17,8 | 2,7 | 2,5 | 100% / 100% | 231,8 / 244,8 ms |
| 4 | 20,9 | 2,6 | 2,6 | 100% / 100% | 253,3 / 250,4 ms |

Promedio no ponderado salida Unity: **21,5 FPS**, muy inferior a ~29,8 FPS de RC5M. En Program/Preview MJPEG los workers continúan cerca de 14–15fps después de calentar, con 1 frame Preview `dropped` en las muestras 3 y 4, errores 0.

**Hallazgo fundamental:** `ROI=100%/100%` continuamente indica que el ROI planeado no se puede aplicar en las escenas reales. Se está ejecutando evaluación DOM de límites/gráficos y captura **completa**, con overhead, y por tanto se penaliza la salida. No asumir una causa específica sin inspección de los rectángulos reales: puede deberse a elementos fullscreen o a umbral área/densidad/geometría DOM.

**Decisión: NO promover RC5R**. El benchmark aislado con cinta sintética (149,6ms vs 126,8ms, -15,2%) no predice la carga del proyecto real. No realizar otro experimento de recorte DOM con video al aire sin entender los elementos fullscreen e implementar un plan de recuperación que no afecte la señal. Regresar a la carpeta validada:
```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-monitor-async"
INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat
```

Mantener intacta la estabilidad Unity ~29,8fps y monitores 15fps. **La cinta HTML requiere una arquitectura de animación no dependiente de PNG fullscreen por movimiento** o un método de captura sustancialmente distinto, después de identificación exacta del tipo de cinta y sus propiedades en Content Studio. No mezclar experimentos fallidos a `v5-monitor-async`, `v5-native` ni `main`.

### Inspección posterior del componente ticker real (solo código, NO validación en Windows)

Los archivos originales de RC5M muestran por qué **este tipo de gráfica** no encaja bien con calcular la unión de todos los `getBoundingClientRect()`:

- `src/components/overlays/TickerMarquee.tsx`: la cinta duplica intencionalmente dos grupos de texto, dentro de `.stdq-ticker-track` con anchura de contenido, para hacer un desplazamiento **continuo sin salto al terminar el ciclo**.
- `src/index.css`: `.stdq-ticker-window { overflow:hidden }` y `.stdq-ticker-track { width:max-content; animation:stdq-ticker-loop ... }`. El resto de la cinta que queda fuera de la ventana visible **debe quedar recortado por CSS**.
- `direct_html_roi.py`: el prototipo ROI unía el rectángulo de **todos los descendientes**, incluso partes de la pista que están fuera de la ventana visible y recortadas. Esto puede expandir el bounding rectangle y hacer que el umbral 72% fuerce fallback a imagen completa. La hipótesis cuadra con `ROI=100%/100%` del usuario, **pero no demuestra que fuera la única causa**, porque no se guardaron bounding boxes DOM de esa ejecución.

**Plan siguiente recomendado, sin codificar más sobre RC5M a ciegas:** capturar el aspecto estático de la cinta y sus grupos tipográficos/máscaras **solo al publicar/cambiar**; animar el desplazamiento horizontal mediante el compositor nativo sobre imágenes premultiplicadas, con la misma dirección, duración, ancho de ciclo y pausa que `TickerMarquee`, en un **hilo/estado separado para Preview y Program**. Mantener un fallback completo para las demás gráficas y probar equivalencia visual fuera de emisión. De esta forma, el ticker deja de requerir PNG de Playwright por cada paso de movimiento; StreamYard puede recibir posiciones de scroll a 30fps aunque los monitores del panel se mantengan a 15fps. Verificar efectos complejos, fuentes, máscaras, bordes y semántica Take antes de cualquier merge.
