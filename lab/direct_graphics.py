"""
OBS MASTER Direct Lab — salida Unity Capture.
Prototipo externo para Windows, NO integrado todavía en Electron.

Corrección de ciclo de vida:
- Browser y context se cierran DENTRO de sync_playwright().
- El hilo abandona la captura después de stop.set().
- El proceso principal espera al renderizador y distingue cierre completo
  de un cierre incompleto.
"""
import argparse
import threading
import time

import cv2
import numpy as np
import pyvirtualcam
from playwright.sync_api import sync_playwright

W, H, FPS = 1280, 720, 30
RENDER_W, RENDER_H = 1920, 1080

lock = threading.Lock()
stop = threading.Event()
state = {"overlay": None, "error": None, "captures": 0, "renderer_done": False}

DEMO = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: transparent;
    font-family: Arial, sans-serif;
}
.banner {
    position: absolute;
    bottom: 8%;
    left: 5%;
    width: 72%;
    padding: 26px 34px;
    border-radius: 18px;
    color: white;
    background: #17191F;
    border-left: 12px solid #FF751C;
    animation: reveal 3s ease-in-out infinite alternate;
}
.title {
    font-size: 42px;
    font-weight: 900;
    letter-spacing: -1px;
}
.subtitle {
    font-size: 19px;
    color: #D2D2D2;
    margin-top: 8px;
}
@keyframes reveal {
    0% { transform: translateX(-110%); opacity: 0; }
    35% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
}
</style>
</head>
<body>
<div class="banner">
  <div class="title">SI TE DIJERA QUE?</div>
  <div class="subtitle">OBS MASTER DIRECT - SIN OBS</div>
</div>
</body>
</html>
"""


def render_overlay(url):
    """Playwright owns its browser; cleanup must occur before Playwright exits."""
    try:
        with sync_playwright() as playwright:
            browser = None
            context = None
            try:
                browser = playwright.chromium.launch(
                    channel="msedge",
                    headless=True,
                )
                context = browser.new_context(
                    viewport={"width": RENDER_W, "height": RENDER_H},
                    device_scale_factor=1,
                )
                page = context.new_page()

                if url:
                    print("Cargando grafica:", url, flush=True)
                    page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=20000,
                    )
                else:
                    print("Usando grafica de demostracion.", flush=True)
                    page.set_content(DEMO)

                while not stop.is_set():
                    started = time.perf_counter()
                    try:
                        data = page.screenshot(
                            type="png",
                            omit_background=True,
                            animations="allow",
                            timeout=10000,
                        )
                        img = cv2.imdecode(
                            np.frombuffer(data, dtype=np.uint8),
                            cv2.IMREAD_UNCHANGED,
                        )
                        if img is None:
                            raise RuntimeError("PNG no decodificado")
                        if len(img.shape) == 2:
                            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                        elif img.shape[2] == 3:
                            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

                        if img.shape[:2] != (H, W):
                            img = cv2.resize(img, (W, H))

                        rgba = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)
                        alpha = rgba[:, :, 3:4].astype(np.float32) / 255.0
                        foreground = rgba[:, :, :3].astype(np.float32) * alpha
                        inverse = 1.0 - alpha

                        with lock:
                            state["overlay"] = (foreground, inverse)
                            state["captures"] += 1
                            state["error"] = None

                    except Exception as exc:
                        if stop.is_set():
                            break
                        with lock:
                            state["error"] = str(exc)
                        stop.wait(0.5)

                    elapsed = time.perf_counter() - started
                    stop.wait(max(0, 0.1 - elapsed))

            finally:
                # CRITICO: cerrar ANTES de salir de sync_playwright().
                if context is not None:
                    try:
                        context.close()
                    except Exception as exc:
                        if not stop.is_set():
                            print("Aviso al cerrar contexto HTML:", exc, flush=True)
                if browser is not None:
                    try:
                        browser.close()
                    except Exception as exc:
                        if not stop.is_set():
                            print("Aviso al cerrar navegador HTML:", exc, flush=True)

    except Exception as exc:
        with lock:
            state["error"] = str(exc)
        if not stop.is_set():
            print("ERROR HTML:", exc, flush=True)
    finally:
        with lock:
            state["renderer_done"] = True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="")
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    print("OBS MASTER DIRECT GRAPHICS", flush=True)
    print("Resolucion: 1280x720 / 30 FPS", flush=True)
    print("Renderizador HTML: 1920x1080", flush=True)
    print("Presiona Ctrl+C para detener.", flush=True)
    print()

    worker = threading.Thread(
        target=render_overlay,
        args=(args.url,),
        daemon=True,
        name="OBS-MASTER-HTML-Renderer",
    )
    worker.start()
    cap = None

    try:
        if args.camera >= 0:
            cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, W)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, H)
                cap.set(cv2.CAP_PROP_FPS, FPS)
                print("Camara fisica abierta:", args.camera, flush=True)
            else:
                print("AVISO: Webcam no disponible.", flush=True)
                cap.release()
                cap = None

        ready = False
        for _ in range(100):
            with lock:
                ready = state["overlay"] is not None
                error = state["error"]
                renderer_done = state["renderer_done"]
            if ready:
                break
            if renderer_done:
                raise RuntimeError(
                    "El renderizador HTML finalizo sin producir una imagen. "
                    "Detalle: " + str(error)
                )
            time.sleep(0.2)

        if not ready:
            raise RuntimeError(
                "No se pudo renderizar la grafica. "
                "Revisa la URL y que OBS MASTER este abierto. "
                "Detalle: " + str(error)
            )

        with pyvirtualcam.Camera(
            width=W,
            height=H,
            fps=FPS,
            fmt=pyvirtualcam.PixelFormat.RGB,
            backend="unitycapture",
        ) as cam:
            print("SALIDA ACTIVA:", cam.device, flush=True)
            print("Selecciona Unity Video Capture en StreamYard.", flush=True)

            counter = 0
            last_status = time.monotonic()
            last_counter = 0

            while not stop.is_set():
                if cap is not None:
                    ok, bgr = cap.read()
                else:
                    ok, bgr = False, None

                if ok and bgr is not None:
                    if bgr.shape[:2] != (H, W):
                        bgr = cv2.resize(bgr, (W, H))
                    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                else:
                    rgb = np.empty((H, W, 3), dtype=np.uint8)
                    rgb[:] = (19, 22, 30)

                with lock:
                    overlay = state["overlay"]
                    captures = state["captures"]
                    error = state["error"]

                if overlay is not None:
                    fg, inverse = overlay
                    rgb = np.clip(
                        rgb.astype(np.float32) * inverse + fg,
                        0, 255,
                    ).astype(np.uint8)

                cam.send(rgb)
                cam.sleep_until_next_frame()
                counter += 1

                now = time.monotonic()
                if now - last_status >= 10:
                    actual = (counter - last_counter) / (now - last_status)
                    print(
                        f"Salida: {actual:.1f} FPS | "
                        f"Capturas HTML: {captures}",
                        flush=True,
                    )
                    if error:
                        print("Aviso HTML:", error, flush=True)
                    last_counter = counter
                    last_status = now

    except KeyboardInterrupt:
        print("Deteniendo salida...", flush=True)
    finally:
        # La camara virtual se libera por su context manager antes de entrar aqui.
        stop.set()
        if cap is not None:
            cap.release()

        # Capturas Playwright pueden durar 10 s y page.goto hasta 20 s.
        # No anunciar cierre limpio si el hilo sigue vivo.
        worker.join(timeout=30)
        if worker.is_alive():
            print(
                "ADVERTENCIA: renderizador HTML sigue cerrando. "
                "Revisa procesos del laboratorio.",
                flush=True,
            )
        else:
            print("OBS MASTER DIRECT detenido.", flush=True)


if __name__ == "__main__":
    main()
