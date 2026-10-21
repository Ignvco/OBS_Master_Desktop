# RC5M — Preview y Program fluidos dentro de OBS MASTER (prueba Windows)

**Estado:** rama experimental `v5-monitor-async`, basada en `v5-perf`. El usuario validó RC5 HD como salida Unity/StreamYard fluida a ~29 FPS; los monitores internos están limitados por código a ~7,5 FPS Program y ~3,75 FPS Preview. **Este cambio todavía NO ha sido validado en Windows.** No fusionar a `v5-perf`, `v5-native` ni `main` hasta QA.

## Motivo y solución acotada

Anteriormente `direct_graphics.py` generaba JPEG de Program cada 4 fotogramas y Preview cada 8, realizando `cv2.resize`, alfa y `cv2.imencode` **dentro del hilo de salida Unity**. Esta cadencia reducida explica la falta de fluidez en los monitores a pesar de StreamYard fluido.

Nuevo `desktop-app/lab/direct_monitor_encoder.py`:
- Un worker de JPEG **Program** independiente y un worker **Preview** independiente, con objetivo inicial **15 FPS cada uno**, tamaño 640×360 y calidad JPEG 68.
- Cola de **un solo frame pendiente por monitor**, reemplaza los frames viejos si la compresión se retrasa (último estado, no se acumula latencia).
- La imagen Program que recibe el worker ya fue enviada exitosamente con `cam.send(rgb)`; codificación tardía no modifica Unity.
- Preview recibe **una copia del fotograma físico anterior al blend Program**, junto a su propia captura HTML; compone y codifica **en el worker de Preview**, nunca altera Program/StreamYard.
- Sólo copia el fotograma original cuando el monitor Preview necesita muestra nueva.
- Nueva telemetría `STDQ_MONITOR program=...fps preview=...fps` cada 10 s, además de `STDQ_PERF` y `Salida`.
- El monitor Python HTTP sigue atendiendo únicamente 127.0.0.1 con token por sesión; el proxy Electron, el Panel En Vivo, Preview selection y el protocolo Take/ACK no se han tocado.

**Límite:** 15 FPS es el objetivo inicial, no una promesa; puede variar si CPU/GPU saturadas. La cámara Unity sigue apuntando a 30 FPS. `html_program/html_preview` (captura Playwright y Motion) sigue aproximadamente 3–4 capturas/s y se optimizará *por separado* sin sacrificar fidelidad gráfica.

## Ejecutar sin tocar versión que funciona

1. Detener Unity Camera y cerrar Electron **desde la bandeja**. Liberar webcam en StreamYard, no emitir públicamente.
2. Conservar el clon `OBS-Master-v5-perf` intacto; este nuevo ensayo vive en una carpeta separada. Antes de probar, respaldar los datos de desarrollo `%APPDATA%\STDQ OBS Master V5 Native Dev\.stdq-runtime`, pues las dos ramas comparten el perfil de trabajo aunque no el código.
3. CMD:
   ```bat
   cd /d "%USERPROFILE%\Desktop"
   git clone --branch v5-monitor-async --single-branch https://github.com/Ignvco/OBS_Master_Desktop.git OBS-Master-v5-monitor-async
   cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-monitor-async"
   INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat
   ```
4. El BAT prueba offline los trabajadores de JPEG y el aislamiento, luego ejecuta `INICIAR_RC5_HD_MJPG_WINDOWS.bat` para lint/core/build/server/py_compile y sincronización exacta `desktop-app/dist`. Configura `STDQ_DIRECT_CAMERA_FOURCC=MJPG`, `STDQ_DIRECT_MONITOR_FPS=15`, `STDQ_DIRECT_MONITORS=1`, `STDQ_DIRECT_DEBUG=1`.
5. En Electron iniciar Unity Camera. Verificar las líneas:
   ```text
   Entrada reportada: 1280x720 / 30.0 FPS configurados / FourCC MJPG
   Monitores internos: 2 JPEG workers async; objetivo 15 FPS cada uno
   Salida: ... FPS | Capturas HTML: ...
   STDQ_MONITOR program=...fps preview=...fps | ...
   STDQ_PERF ... monitors=...ms
   ```
6. Mover manos/cabeza y observar los **dos monitores**. Comparar **15 FPS previstos** frente al anterior 7,5/3,75. Por separado, comprobar que StreamYard continúa fluido cercano a 30 FPS.
7. Preparar Banner y Lower Third en Preview y verificar que no llegan a Program/StreamYard anticipadamente. Ejecutar **TAKE · CUT** y confirmar ACK y resultado en StreamYard. Retirar una gráfica en Preview y repetir Cut, sin artefactos.
8. Dejar 10–15 min inicialmente; si funciona, probar >=30 min, 5–10 Cut, cerrar y reiniciar cámara 5 veces sin procesos huérfanos. Comparar `STDQ_MONITOR` + `Salida` antes/después.

## Criterios de éxito

- La webcam Unity/StreamYard mantiene 720p y ~29–30 FPS (sin degradación sostenida del benchmark anterior).
- Program y Preview internos muestran movimiento más fluido que 7,5/3,75 FPS; idealmente ~12–15 FPS cada uno sin congelarse.
- `STDQ_MONITOR` reporta tasas aproximadas de generación JPEG y eventuales `dropped` si la CPU no alcanza. Los descartes acotados son preferibles a latencia acumulada, pero tasas bajas persistentes requieren profiling.
- `TAKE · CUT`, estado Preview aislado, publicación y Motion no presentan regresiones.
- Stop y reinicio ordenado.
- Si alguna validación falla, **cerrar completamente la app** y volver a abrir el clon `OBS-Master-v5-perf` mediante `INICIAR_RC5_HD_MJPG_WINDOWS.bat`. Ningún cambio ha sido aplicado a su rama.

**No dar por aprobado el incremento de monitores solo por `Salida: 30 FPS`**: necesitamos confirmar explícitamente las tasas `STDQ_MONITOR` y percepción en En Vivo.

## Hallazgo RC5M en Windows — pérdida de cadencia al muestrear

**Medición real del usuario:** Unity sigue funcionando ~28–30 FPS con caídas transitorias a 25,1–25,7 FPS. Los dos JPEG monitores publicaron de forma sostenida ~**11,2–11,4 FPS** cada uno, aunque se configuraron 15; hubo `dropped=0` y `errors=0`, por lo que los codificadores terminaron de procesar todo lo que recibieron. `STDQ_PERF monitors=0.06–0.11ms` mide **el costo de encolar**, NO la CPU de los workers JPEG. Un `STDQ_TAKE_ACK` confirmó funcionamiento del Take.

**Causa principal del submuestreo:** `_LatestFrameChannel.offer` actualizaba `next_due=timestamp+interval` al aceptar un fotograma. Con fuente ~30 FPS y objetivo 15 FPS, el intervalo de 66,67ms puede no haberse cumplido al cabo de 2 fotogramas por pequeñas variaciones de tiempo; espera 3 en ocasiones, cayendo a ~11 FPS. Esto NO es evidencia de fallo de red ni de lentitud del proxy MJPEG.

**Corrección implementada en misma rama experimental:** ahora `next_due` avanza por los intervalos absolutos (phase-lock), salta deadlines perdidos sin catch-up y mantiene cola de tamaño uno. Las pruebas `test_direct_monitor_encoder.py` incluyen escenario determinista de 600 muestras a 30Hz con jitter (antes ~232 de 600, ahora ~300 de 600) y pausa larga (sin ráfaga).

**La mejora en Windows sigue pendiente.** No prometer 15 FPS hasta que aparezca `STDQ_MONITOR program=~15fps preview=~15fps` durante varias mediciones. Verificar si la carga extra provoca caídas Unity sostenidas a 25 FPS; si las provoca, reducir calidad JPEG o tasa de monitores antes de sacrificar StreamYard.

### Reprobar en mismo clon Windows (no clonar nuevamente)

Cierra completamente OBS MASTER desde bandeja y Unity Camera; desde CMD:
```bat
cd /d "%USERPROFILE%\Desktop\OBS-Master-v5-monitor-async"
git pull origin v5-monitor-async
INICIAR_RC5_MONITORES_FLUIDOS_WINDOWS.bat
```

El BAT ejecuta pruebas de temporización y aislamiento antes de compilar y copiar los assets. Comparar al menos 5 líneas `STDQ_MONITOR` y `Salida`. Repetir un Cut para verificar aislamiento Preview→Program y observar StreamYard. Si hay regresiones, volver al clon `OBS-Master-v5-perf` con su BAT MJPG anterior, sin hacer merge.

## RC5M — Resultado confirmado del phase-lock en Windows 10 (21-oct-2026)

El usuario ejecutó la versión corregida tras `git pull v5-monitor-async`. Se recibieron 13 ventanas consecutivas de telemetría en Unity Camera:

- **Salida Unity**: `28.4, 30.1, 30.1, 30.2, 30.1, 30.1, 29.3, 29.0, 30.0, 30.1, 30.1, 30.0, 30.0` FPS. Promedio no ponderado de ventanas **29,81 FPS** (mínimo 28,4, máximo 30,2).
- **Monitores Program y Preview**: primera ventana durante arranque `10.9fps`; las **12 ventanas restantes muestran 14,9–15,1 FPS en ambos monitores**, sin decrecimiento sostenido.
- **Workers JPEG**: los contadores acumulados muestran `dropped=0`, `errors=0` para ambos; `encoded` alcanza 1943 (de 1944 ofrecidos), apenas un cuadro pendiente.
- **Sobrecarga del hilo de Unity para los monitores**: `STDQ_PERF monitors=0.03–0.04ms` por fotograma (medición de encolado, NO de la compresión dentro de los dos workers).
- **Composición**: `blend` en torno a 6–7,5ms, `send` cercano a 0,11ms y lectura de cámara promedio ~24–27ms en la fase estable.
- **Rasterización HTML**: `Capturas HTML` pasó de 44 a 498 (unas 30–40 capturas Program cada 10s), y `html_program` y `html_preview` continúan entre cientos de ms por captura. **Esto no impide ya los 15 FPS de monitores, pero las animaciones de las gráficas pueden actualizarse más despacio que el video físico.**

**Resultado técnico medido:** la corrección de temporización permitió alcanzar 15 FPS de JPEG en Preview y Program **sin reducir la frecuencia de salida Unity**. La anomalía de 11 FPS estaba en la actualización del deadline y queda corregida según telemetría Windows. **La validación perceptual final del usuario y la recepción StreamYard tras esta versión siguen pendientes**. Tampoco se ha reportado un Take/Cut nuevo en este registro (no aparece `STDQ_TAKE_ACK`); confirmar que sigue funcionando, no inferirlo de versiones anteriores.

### Próximas puertas de QA

1. Confirmación del usuario: Preview y Program se ven más fluidos, StreamYard continúa fluido y en 16:9 720p sin desajustes.
2. Dos Take/Cut con diferentes overlays; Preview permanece aislado hasta cada Cut y al-air corresponde a la selección.
3. Mínimo 30 minutos de operación y múltiples reinicios de la cámara sin pérdida acumulada ni procesos de Edge huérfanos.
4. Después, analizar independientemente el cuello de botella de screenshots animados Playwright; no aumentar en bloque la tasa de captura sin medir consumo CPU/GPU ni sacrificar fidelidad de Content Studio.
5. **No fusionar a `v5-perf`, `v5-native` ni `main`** hasta terminar las pruebas. Mantener rollback a `INICIAR_RC5_HD_MJPG_WINDOWS.bat` en el clon `OBS-Master-v5-perf`.
