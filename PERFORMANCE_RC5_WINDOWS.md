# RC5 — Diagnóstico y optimización de fluidez del motor Direct

**Rama experimental:** `v5-perf` (basada en el RC4B validado en `v5-native`). **NO modificar ni fusionar `main`**. El código experimental aún no ha pasado los tests reales en Windows.

## Evidencia aportada por usuario

En Windows 10, OBS MASTER Direct Engine con Unity Video Capture y StreamYard mostró:
- Salida configurada 1280 × 720 / 30 FPS.
- FPS **reales** entre **7,4 y 10,1**; deterioro progresivo desde aproximadamente 9,6.
- Dos navegadores Edge/Playwright (Program + Preview) haciendo capturas HTML a 1920 × 1080.
- `STDQ_TAKE_ACK` después del cambio de composición; salida estable pero poco fluida; cierre limpio (código 0).

**Conclusión de diagnóstico:** el proceso real de video ya entrega ~8–10 FPS; la menor fluidez no es solo una percepción del monitor MJPEG ni se explica por el servidor de loopback. Aún no se atribuye a una operación concreta sin nuevas mediciones. `cam.send` confirma envío pero no FPS reales consumidos en StreamYard.

## RC5 — Instrumentación aplicada

En `desktop-app/lab/direct_graphics.py`:
- `STDQ_PERF` cada ~10 s con promedio **por fotograma** de: `camera` (captura), `blend` (selección + composición), `send` (Unity), `monitors` (codificación JPEG), `sleep` (ritmo impuesto por pyvirtualcam). También duración del último render HTML Program y Preview.
- Log de resolución, FPS y FourCC **reportados** por DirectShow; no son prueba de tasa efectiva.
- Variable experimental `STDQ_DIRECT_MONITORS=0` para desactivar **solo la generación MJPEG de Preview/Program dentro de Electron** (mantiene la captura HTML Preview para Take). En modo apagado, los monitores de la app no mostrarán señal y puede aparecer su fallback; **StreamYard y Unity Capture siguen activos**. No usar como opción de transmisión habitual.
- Mezcla alpha experimental: detectar el área visible, recortarla, premultiplicar los colores **una vez por captura HTML** y mezclar solo ese rectángulo en RGB/`uint8` mediante `cv2.multiply`/`cv2.add`. El bucle de video deja de crear buffers `float32` de toda la imagen para cada frame.
- Fotograma base para Preview JPEG se copia **solo cada 8 frames**, en vez de necesitar otro buffer por cada frame.
- Se conserva Take nativo, revisión de Preview, ACK después de `cam.send`, rollback, publicación e historial sin cambios de semántica.

`desktop-app/lab/test_direct_perf.py` hace pruebas sin webcam: transparentes, opacos, mezcla alpha dentro de tolerancia de 2 niveles de color y aislamiento de Preview/Program. `INICIAR_RC5_PERF_WINDOWS.bat` ejecuta las pruebas con el entorno Python validado y luego el iniciador existente con lint/test/build/desktop:server/py_compile.

**Sin garantía de 30 FPS:** la mejora debe medirse. Capturas Playwright completas y formato de cámara pueden seguir siendo cuellos de botella. No se han cambiado ajustes de entrada, escala ni calidad visual por cuenta propia.

## Protocolo de validación Windows — NO durante emisión pública

### Preparación

1. Cierra OBS MASTER desde bandeja y detén Unity Camera. Comprueba que no hay Direct Lab externo o segundo OBS MASTER ocupando puerto 3000.
2. Conserva el proyecto ya validado `OBS-Master-v5-native` **sin actualizarlo con esta prueba**. Haz copia de seguridad de los datos de desarrollo en `%APPDATA%\STDQ OBS Master V5 Native Dev\.stdq-runtime` antes de probar; el ejecutable de prueba utiliza el mismo perfil de desarrollo y no debe cambiar el contenido publicado salvo cuando tú decidas hacerlo.
3. Desde **CMD**, crea una carpeta nueva:
   ```bat
   cd /d "%USERPROFILE%\Desktop"
   git clone --branch v5-perf --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-perf
   cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-perf"
   set STDQ_DIRECT_DEBUG=1
   set STDQ_DIRECT_MONITORS=1
   INICIAR_RC5_PERF_WINDOWS.bat
   ```
4. Si no existe Python validado, alguna prueba falla o el BAT no inicia, **no insistir**; guardar el log y regresar al RC4B en `OBS-Master-v5-native`.

### Escenario A — motor optimizado, monitores ON

1. Inicia Unity Camera en la bandeja; abre StreamYard, dispositivo `Unity Video Capture`.
2. Deja la cámara en pantalla, sin cambiar escenas, durante **60–90 segundos**.
3. Registra 5–8 líneas `Salida: NN.N FPS` y sus líneas `STDQ_PERF`.
4. Prepara Banner y Lower Third en Preview; verifica aislamiento; haz **un Cut** y registra latencia, FPS y resultado en StreamYard.
5. Deja funcionar otros 60 segundos. Vigila caída progresiva y temperatura/CPU en Administrador de tareas.
6. Detén Unity Camera limpiamente antes de la siguiente comparación.

### Escenario B — medir el costo de los monitores JPEG

Con OBS MASTER cerrado, en la MISMA ventana CMD de pruebas:
```bat
set STDQ_DIRECT_MONITORS=0
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-perf\desktop-app"
npm start
```
Abre StreamYard y vuelve a iniciar Unity Camera desde la bandeja. **Los monitores internos no mostrarán señal**, esto es esperado. Mide 60–90 segundos sin Take. Compara `Salida` y `STDQ_PERF` contra escenario A. Detén la cámara y el proceso Electron al finalizar.

Recuerda que **desactivar MJPEG no elimina los renderizadores Playwright** y puede no cambiar suficiente el rendimiento.

## Interpretación

- `camera` alto: revisar lectura de webcam y formato/driver DirectShow; `reported FPS` no demuestra capacidad real.
- `blend` alto: rectángulo alpha/CPU; comparar contra RC4B antes de ajustar.
- `monitors` alto: JPEG y copias de las dos vistas; modo OFF aísla ese costo.
- `send` alto: Unity Capture/driver y buffers.
- `sleep` alto con FPS cerca de 30: espera del reloj, comportamiento normal.
- `html_program` y `html_preview` altos: capturas PNG 1920 × 1080/Playwright consumen tiempo; pueden sobrecargar CPU incluso en otro hilo.
- FPS mejoran y luego vuelven a degradarse: evaluar uso de memoria y acumulación de procesos; no declarar resuelto.

## Criterios de paso

- Todos los tests y comprobaciones pasan en Windows.
- Sin regresiones visibles en tipografía, transparencias, Motion, máscaras y logo.
- RC4B Take/Cut y su aislamiento continúan correctos.
- StreamYard mantiene señal estable con mejora de FPS medida y repetible en 2 sesiones; no se exige afirmar 30 FPS si no se alcanzan.
- Inicio/stop 5 ciclos mínimos sin traceback, procesos huérfanos ni fuga evidente. 20 ciclos para declarar estable.
- Si la mejora no se produce, NO fusionar `v5-perf`: siguiente experimento es el formato de webcam (YUY2/MJPEG), rasterización HTML a 1080p o una vía GPU, cada uno con métricas.

**Importante:** no confundir `v5-perf` con una nueva pantalla ni rama de producto. Es un laboratorio reversible; el único Panel En Vivo sigue siendo el aprobado.
