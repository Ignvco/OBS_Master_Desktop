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
import os
import queue
import sys
import threading
import time

import cv2
import numpy as np
import pyvirtualcam
from playwright.sync_api import sync_playwright
from direct_monitor import ProgramMonitor

W, H, FPS = 1280, 720, 30
RENDER_W, RENDER_H = 1920, 1080

lock = threading.Lock()
stop = threading.Event()
state = {"overlay": None, "preview_overlay": None, "preview_revision": -1,
         "program_rendered_take_id": "", "error": None, "preview_error": None,
         "captures": 0, "renderer_done": False,
         "render_program_ms": 0.0, "render_preview_ms": 0.0}
control_queue = queue.Queue()

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


def render_overlay(url, channel="program"):
    """Each channel owns its Playwright lifecycle; Preview never overwrites Program."""
    slot = "overlay" if channel == "program" else "preview_overlay"
    error_slot = "error" if channel == "program" else "preview_error"
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
                        # The revision/id is read BEFORE and AFTER the PNG.
                        # An in-flight React render cannot be confused with the
                        # frame that is actually staged or emitted.
                        marker = ("data-direct-preview-revision"
                                  if channel == "preview" else "data-direct-take-id")
                        selector = "[%s]" % marker
                        before = page.locator(selector).get_attribute(marker, timeout=2500)
                        data = page.screenshot(
                            type="png",
                            omit_background=True,
                            animations="allow",
                            timeout=10000,
                        )
                        after = page.locator(selector).get_attribute(marker, timeout=2500)
                        if before != after:
                            # Snapshot changed while screenshot was being captured.
                            continue
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
                            state[slot] = (foreground, inverse)
                            if channel == "program":
                                state["captures"] += 1
                            state[error_slot] = None
                            state["render_preview_ms" if channel == "preview" else "render_program_ms"] = (time.perf_counter()-started)*1000.0
                            if channel == "preview":
                                state["preview_revision"] = int(after) if after and after.isdigit() else -1
                            else:
                                state["program_rendered_take_id"] = after or ""

                    except Exception as exc:
                        if stop.is_set():
                            break
                        with lock:
                            state[error_slot] = str(exc)
                        stop.wait(0.5)

                    elapsed = time.perf_counter() - started
                    stop.wait(max(0, (0.1 if channel == "program" else 0.75) - elapsed))

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
            state[error_slot] = str(exc)
        if not stop.is_set():
            print("ERROR HTML:", exc, flush=True)
    finally:
        if channel == "program":
            with lock:
                state["renderer_done"] = True


def listen_commands():
    """Control cooperativo desde Electron; no cerrar Playwright desde otro hilo."""
    try:
        for line in sys.stdin:
            parts = line.strip().split()
            if not parts:
                continue
            if parts[0].upper() == "STOP":
                stop.set()
                return
            if parts[0].upper() == "TAKE" and len(parts) == 3:
                try:
                    revision = int(parts[1])
                    take_id = parts[2].lower()
                    if revision >= 0 and len(take_id) == 32 and all(c in "0123456789abcdef" for c in take_id):
                        control_queue.put(("TAKE", revision, take_id))
                except ValueError:
                    pass
            elif parts[0].upper() == "ROLLBACK" and len(parts) == 2:
                control_queue.put(("ROLLBACK", -1, parts[1].lower()))
    except (OSError, ValueError):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--preview-url", default="http://127.0.0.1:3000/?overlay=direct-preview")
    args = parser.parse_args()

    print("OBS MASTER DIRECT GRAPHICS", flush=True)
    print("Resolucion: 1280x720 / 30 FPS", flush=True)
    print("Renderizador HTML: 1920x1080", flush=True)
    print("Presiona Ctrl+C o envia STOP por stdin para detener.", flush=True)
    print()
    threading.Thread(target=listen_commands, daemon=True, name="OBS-MASTER-Direct-Control").start()

    worker = threading.Thread(
        target=render_overlay,
        args=(args.url,),
        daemon=True,
        name="OBS-MASTER-HTML-Renderer",
    )
    worker.start()
    preview_worker = None
    if os.environ.get("STDQ_DIRECT_MONITOR_TOKEN"):
        preview_worker = threading.Thread(
            target=render_overlay, args=(args.preview_url, "preview"),
            daemon=True, name="OBS-MASTER-Preview-Renderer",
        )
        preview_worker.start()
    cap = None
    monitor = None
    monitor_token = os.environ.get("STDQ_DIRECT_MONITOR_TOKEN", "")
    monitor_enabled = os.environ.get("STDQ_DIRECT_MONITORS", "1") != "0"
    if monitor_token and monitor_enabled:
        monitor = ProgramMonitor(
            token=monitor_token,
            port=int(os.environ.get("STDQ_DIRECT_MONITOR_PORT", "31311")),
        )
        try:
            monitor.start()
        except Exception as exc:
            monitor = None
            print("Aviso: monitor de Program no disponible:", exc, flush=True)


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
            if stop.wait(0.2):
                return

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
            stat_ms = {"camera":0.0,"blend":0.0,"send":0.0,"monitors":0.0,"sleep":0.0}
            stat_frames = 0
            active_override = None
            override_take_id = None
            pending_take_ack = None
            pending_rollback_ack = None

            while not stop.is_set():
                t_camera = time.perf_counter()
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

                stat_ms["camera"] += (time.perf_counter()-t_camera)*1000.0
                t_blend = time.perf_counter()
                base_rgb = rgb
                with lock:
                    overlay = state["overlay"]
                    preview_overlay = state["preview_overlay"]
                    preview_revision = state["preview_revision"]
                    browser_take_id = state["program_rendered_take_id"]
                    captures = state["captures"]
                    error = state["error"]
                    render_program_ms = state["render_program_ms"]
                    render_preview_ms = state["render_preview_ms"]

                # Control commands are consumed ONLY in the single camera
                # output thread. This keeps output switching frame-aligned.
                while True:
                    try:
                        action, requested_revision, request_id = control_queue.get_nowait()
                    except queue.Empty:
                        break
                    if action == "TAKE":
                        if preview_overlay is None or preview_revision != requested_revision:
                            print("STDQ_TAKE_NACK", request_id, "PREVIEW_NOT_READY", flush=True)
                        elif active_override is not None:
                            print("STDQ_TAKE_NACK", request_id, "TAKE_BUSY", flush=True)
                        else:
                            active_override = preview_overlay
                            override_take_id = request_id
                            pending_take_ack = request_id
                    elif action == "ROLLBACK":
                        if override_take_id == request_id:
                            active_override = None
                            override_take_id = None
                        pending_rollback_ack = request_id

                # The React Program worker eventually receives committed live
                # flags plus this same take ID. Only then may its composition
                # replace the temporary Preview snapshot without reverting
                # visible content between engine ACK and station commit.
                if active_override is not None and browser_take_id == override_take_id:
                    active_override = None
                    override_take_id = None

                applied_overlay = active_override if active_override is not None else overlay
                if applied_overlay is not None:
                    fg, inverse = applied_overlay
                    rgb = np.clip(
                        rgb.astype(np.float32) * inverse + fg,
                        0, 255,
                    ).astype(np.uint8)

                stat_ms["blend"] += (time.perf_counter()-t_blend)*1000.0
                t_send = time.perf_counter()
                cam.send(rgb)
                stat_ms["send"] += (time.perf_counter()-t_send)*1000.0
                counter += 1
                if pending_take_ack is not None:
                    print("STDQ_TAKE_ACK", pending_take_ack, counter, flush=True)
                    pending_take_ack = None
                if pending_rollback_ack is not None:
                    print("STDQ_ROLLBACK_ACK", pending_rollback_ack, counter, flush=True)
                    pending_rollback_ack = None

                t_monitors = time.perf_counter()
                # Every previewed frame was successfully submitted to Unity.
                # JPEG monitoring is intentionally capped near 7.5fps to avoid
                # competing with the 30fps broadcast compositor.
                if monitor is not None and counter % 4 == 0:
                    reduced = cv2.resize(rgb, (640, 360), interpolation=cv2.INTER_AREA)
                    ok, jpeg = cv2.imencode(
                        ".jpg", cv2.cvtColor(reduced, cv2.COLOR_RGB2BGR),
                        [int(cv2.IMWRITE_JPEG_QUALITY), 70],
                    )
                    if ok:
                        monitor.publish(jpeg.tobytes())

                # Independently composited Preview: same physical input frame,
                # different HTML overlay. NEVER send Preview to Unity Capture.
                if monitor is not None and counter % 8 == 0:
                    if preview_overlay is not None:
                        p_fg, p_inverse = preview_overlay
                        preview_rgb = np.clip(
                            base_rgb.astype(np.float32) * p_inverse + p_fg,
                            0, 255,
                        ).astype(np.uint8)
                    else:
                        preview_rgb = base_rgb
                    small = cv2.resize(preview_rgb, (640, 360), interpolation=cv2.INTER_AREA)
                    ok, jpeg = cv2.imencode(
                        ".jpg", cv2.cvtColor(small, cv2.COLOR_RGB2BGR),
                        [int(cv2.IMWRITE_JPEG_QUALITY), 70],
                    )
                    if ok:
                        monitor.publish_preview(jpeg.tobytes())

                stat_ms["monitors"] += (time.perf_counter()-t_monitors)*1000.0
                t_sleep = time.perf_counter()
                cam.sleep_until_next_frame()
                stat_ms["sleep"] += (time.perf_counter()-t_sleep)*1000.0
                stat_frames += 1

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
                    if stat_frames:
                        print(
                            "STDQ_PERF "
                            + " ".join(f"{key}={value/stat_frames:.2f}ms" for key,value in stat_ms.items())
                            + f" html_program={render_program_ms:.1f}ms"
                            + f" html_preview={render_preview_ms:.1f}ms"
                            + f" frames={stat_frames}",
                            flush=True,
                        )
                    for key in stat_ms:
                        stat_ms[key] = 0.0
                    stat_frames = 0
                    last_counter = counter
                    last_status = now

    except KeyboardInterrupt:
        print("Deteniendo salida...", flush=True)
    finally:
        # La camara virtual se libera por su context manager antes de entrar aqui.
        stop.set()
        if monitor is not None:
            monitor.close()
        if cap is not None:
            cap.release()

        # Capturas Playwright pueden durar 10 s y page.goto hasta 20 s.
        # No anunciar cierre limpio si el hilo sigue vivo.
        worker.join(timeout=30)
        if preview_worker is not None:
            preview_worker.join(timeout=30)
        if worker.is_alive() or (preview_worker is not None and preview_worker.is_alive()):
            print(
                "ADVERTENCIA: renderizador HTML sigue cerrando. "
                "Revisa procesos del laboratorio.",
                flush=True,
            )
        else:
            print("OBS MASTER DIRECT detenido.", flush=True)


if __name__ == "__main__":
    main()
