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
from direct_monitor_encoder import AsyncMonitorEncoder
from direct_html_roi import STAGE_BOUNDS_JS, roi_plan, to_pixels

W, H, FPS = 1280, 720, 30
RENDER_W, RENDER_H = 1920, 1080


def html_capture_profile(height, channel):
    """Isolated opt-in: rasterize native 1920x1080 stage to 1280x720.

    Device scaling preserves 1920x1080 CSS viewport/breakpoints/geometry,
    unlike shrinking the viewport or altering the root's CSS transform.
    Not applied to Content Studio or Electron's production control UI.
    """
    if height not in (720, 1080):
        raise ValueError("STDQ_DIRECT_HTML_CAPTURE must be 720 or 1080")
    if channel not in ("program", "preview"):
        raise ValueError("HTML channel must be program or preview")
    if height == 1080:
        return {
            "viewport": (RENDER_W, RENDER_H),
            "device_scale_factor": 1.0,
            "screenshot_scale": "css",
            "interval": 0.1 if channel == "program" else 0.75,
        }
    return {
        # Keep the actual CSS viewport 1920x1080, including breakpoints,
        # positions and document dimensions. Use reduced device pixel ratio
        # ONLY for the headless HTML screenshot, never for Content Studio.
        # Chromium outputs 1280x720 device pixels with scale="device".
        "viewport": (RENDER_W, RENDER_H),
        "device_scale_factor": W / RENDER_W,
        "screenshot_scale": "device",
        "interval": 0.10 if channel == "program" else 0.125,
    }


lock = threading.Lock()
stop = threading.Event()
state = {"overlay": None, "preview_overlay": None, "preview_revision": -1,
         "program_rendered_take_id": "", "error": None, "preview_error": None,
         "captures": 0, "renderer_done": False,
         "render_program_ms": 0.0, "render_preview_ms": 0.0,
         "screenshot_program_ms": 0.0, "screenshot_preview_ms": 0.0,
         "captures_preview": 0,
         "roi_program_area": 1.0, "roi_preview_area": 1.0}
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


def compile_overlay(rgba):
    """Crop transparent pixels and premultiply ONCE per HTML screenshot.

    The output loop blends uint8 pixels in OpenCV C++ instead of allocating
    full-frame float32 arrays at each camera frame.
    Empty Preview remains a valid captured overlay for Cut-to-webcam.
    """
    alpha = rgba[:, :, 3]
    if cv2.countNonZero(alpha) == 0:
        return (0, 0, None, None)
    x, y, width, height = cv2.boundingRect(alpha)
    a = np.ascontiguousarray(alpha[y:y + height, x:x + width])
    color = np.ascontiguousarray(rgba[y:y + height, x:x + width, :3])
    alpha3 = cv2.cvtColor(a, cv2.COLOR_GRAY2RGB)
    premultiplied = cv2.multiply(color, alpha3, scale=1.0 / 255.0)
    inverse = cv2.cvtColor(255 - a, cv2.COLOR_GRAY2RGB)
    return (x, y, premultiplied, inverse)


def blend_overlay_inplace(frame, overlay):
    if overlay is None:
        return frame
    x, y, foreground, inverse = overlay
    if foreground is None:
        return frame
    height, width = foreground.shape[:2]
    region = frame[y:y + height, x:x + width]
    blended = cv2.add(
        cv2.multiply(region, inverse, scale=1.0 / 255.0),
        foreground,
    )
    region[:] = blended
    return frame


def configure_capture(cap, width, height, fps, requested_codec=""):
    """Request MJPEG LAST. Do not reconfigure width or FPS afterwards.

    Windows DSHOW may reset the selected media subtype when dimensions change.
    Keeping this order is required by RC5's validated webcam benchmark.
    """
    codec = requested_codec.strip().upper()
    if codec and codec not in ("MJPG", "YUY2"):
        raise ValueError("STDQ_DIRECT_CAMERA_FOURCC accepts only MJPG or YUY2")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    if not codec:
        return None
    accepted = cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*codec))
    return accepted


def render_overlay(url, channel="program"):
    """Each channel owns its Playwright lifecycle; Preview never overwrites Program."""
    slot = "overlay" if channel == "program" else "preview_overlay"
    error_slot = "error" if channel == "program" else "preview_error"
    height = int(os.environ.get("STDQ_DIRECT_HTML_CAPTURE", "1080"))
    profile = html_capture_profile(height, channel)
    roi_mode = os.environ.get("STDQ_DIRECT_HTML_ROI", "0") == "1"
    if roi_mode and height != 720:
        raise ValueError("STDQ_DIRECT_HTML_ROI requires STDQ_DIRECT_HTML_CAPTURE=720")
    print(
        f"HTML {channel}: CSS viewport={profile['viewport'][0]}x{profile['viewport'][1]} "
        f"DPR={profile['device_scale_factor']:.4f} "
        f"intervalo={profile['interval'] * 1000:.0f}ms "
        f"modo={'rasterizado 720p' if height == 720 else 'original 1080p'} "
        f"ROI={'ON' if roi_mode else 'OFF'}",
        flush=True,
    )
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
                    viewport={"width": profile["viewport"][0],
                              "height": profile["viewport"][1]},
                    device_scale_factor=profile["device_scale_factor"],
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
                        clip = None
                        blank = False
                        if roi_mode:
                            metadata = page.locator(selector).evaluate(
                                STAGE_BOUNDS_JS, marker, timeout=2500,
                            )
                            before = metadata["marker"]
                            clip, blank = roi_plan(metadata)
                        else:
                            before = page.locator(selector).get_attribute(marker, timeout=2500)
                        screenshot_started = time.perf_counter()
                        if blank:
                            img = np.zeros((H, W, 4), dtype=np.uint8)
                        else:
                            kwargs = {
                                "type": "png",
                                "omit_background": True,
                                "animations": "allow",
                                "scale": profile["screenshot_scale"],
                                "timeout": 10000,
                            }
                            if clip is not None:
                                kwargs["clip"] = clip
                            try:
                                data = page.screenshot(**kwargs)
                                img = cv2.imdecode(
                                    np.frombuffer(data, dtype=np.uint8),
                                    cv2.IMREAD_UNCHANGED,
                                )
                                if img is None:
                                    raise RuntimeError("PNG no decodificado")
                                if img.ndim == 2:
                                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                                elif img.shape[2] == 3:
                                    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
                                if clip is not None:
                                    px, py, pw, ph = to_pixels(clip)
                                    if img.shape[:2] != (ph, pw):
                                        raise ValueError(
                                            f"ROI screenshot {img.shape[:2]} != {(ph,pw)}"
                                        )
                                    full = np.zeros((H, W, 4), dtype=np.uint8)
                                    full[py:py + ph, px:px + pw] = img
                                    img = full
                            except Exception as roi_exc:
                                if clip is None:
                                    raise
                                # Unsupported clipping must not interrupt on-air
                                # graphics. Fall back to the proven full shot.
                                print("HTML ROI fallback:", channel, roi_exc, flush=True)
                                clip = None
                                data = page.screenshot(
                                    type="png", omit_background=True,
                                    animations="allow",
                                    scale=profile["screenshot_scale"],
                                    timeout=10000,
                                )
                                img = cv2.imdecode(
                                    np.frombuffer(data, dtype=np.uint8),
                                    cv2.IMREAD_UNCHANGED,
                                )
                                if img is None:
                                    raise RuntimeError("PNG fallback no decodificado")
                                if img.ndim == 2:
                                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
                                elif img.shape[2] == 3:
                                    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
                        screenshot_ms = (time.perf_counter() - screenshot_started) * 1000.0
                        after = page.locator(selector).get_attribute(marker, timeout=2500)
                        if before != after:
                            # Never accept a Preview/Program frame from a
                            # mixed revision or a racing Take.
                            continue
                        if height == 720 and img.shape[:2] != (H, W):
                            raise RuntimeError(
                                f"Captura HD esperada {W}x{H}, "
                                f"Playwright devolvió {img.shape[1]}x{img.shape[0]}"
                            )
                        if img.shape[:2] != (H, W):
                            img = cv2.resize(img, (W, H))

                        rgba = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)
                        optimized = compile_overlay(rgba)

                        with lock:
                            state[slot] = optimized
                            if channel == "program":
                                state["captures"] += 1
                            state[error_slot] = None
                            state["render_preview_ms" if channel == "preview" else "render_program_ms"] = (time.perf_counter()-started)*1000.0
                            state["screenshot_preview_ms" if channel == "preview" else "screenshot_program_ms"] = screenshot_ms
                            fraction = (
                                (clip["width"] * clip["height"]) / (RENDER_W * RENDER_H)
                                if clip is not None else (0.0 if blank else 1.0)
                            )
                            state["roi_preview_area" if channel == "preview" else "roi_program_area"] = fraction
                            if channel == "preview":
                                state["captures_preview"] += 1
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
                    stop.wait(max(0, profile["interval"] - elapsed))

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
    monitor_encoder = None
    monitor_token = os.environ.get("STDQ_DIRECT_MONITOR_TOKEN", "")
    monitor_enabled = os.environ.get("STDQ_DIRECT_MONITORS", "1") != "0"
    if monitor_token and monitor_enabled:
        monitor = ProgramMonitor(
            token=monitor_token,
            port=int(os.environ.get("STDQ_DIRECT_MONITOR_PORT", "31311")),
        )
        try:
            monitor.start()
            # Both MJPEG previews are optional and isolated from the Unity
            # output loop. Higher rates must NEVER delay camera.send().
            monitor_fps = int(os.environ.get("STDQ_DIRECT_MONITOR_FPS", "15"))
            monitor_encoder = AsyncMonitorEncoder(
                monitor, stop, blend_overlay_inplace, fps=monitor_fps,
            )
            monitor_encoder.start()
            print(f"Monitores internos: 2 JPEG workers async; objetivo {monitor_fps} FPS cada uno", flush=True)
        except Exception as exc:
            if monitor_encoder is not None:
                monitor_encoder.close()
                monitor_encoder = None
            if monitor is not None:
                monitor.close()
            monitor = None
            print("Aviso: monitor de Program no disponible:", exc, flush=True)


    try:
        if args.camera >= 0:
            cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
            if cap.isOpened():
                # Opt-in only. Default settings are exactly those validated in
                # RC4B. Test MJPG only after the standalone camera benchmark.
                requested_codec = os.environ.get("STDQ_DIRECT_CAMERA_FOURCC", "").strip().upper()
                accepted = configure_capture(cap, W, H, FPS, requested_codec)
                if requested_codec:
                    print("Formato solicitado al final:", requested_codec,
                          "| set FourCC:", accepted, flush=True)
                width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                reported_fps = cap.get(cv2.CAP_PROP_FPS)
                fourcc_raw = int(cap.get(cv2.CAP_PROP_FOURCC) or 0)
                fourcc = "".join(chr((fourcc_raw >> (8 * i)) & 255) for i in range(4))
                readable_fourcc = fourcc if all(32 <= ord(letter) < 127 for letter in fourcc) else f"unknown 0x{fourcc_raw & 0xffffffff:08X}"
                if requested_codec and fourcc != requested_codec:
                    print("ADVERTENCIA: el controlador NO confirmó", requested_codec,
                          "| subtipo devuelto:", readable_fourcc, flush=True)
                print("Camara fisica abierta:", args.camera, flush=True)
                print(
                    f"Entrada reportada: {width:.0f}x{height:.0f} / "
                    f"{reported_fps:.1f} FPS configurados / "
                    f"FourCC {readable_fourcc}; la tasa real se mide abajo",
                    flush=True,
                )
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
            last_html_captures = 0
            last_preview_captures = 0
            stat_ms = {"camera":0.0,"read":0.0,"convert":0.0,"blend":0.0,"send":0.0,"monitors":0.0,"sleep":0.0}
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

                capture_read_end = time.perf_counter()
                stat_ms["read"] += (capture_read_end-t_camera)*1000.0
                if ok and bgr is not None:
                    if bgr.shape[:2] != (H, W):
                        bgr = cv2.resize(bgr, (W, H))
                    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                else:
                    rgb = np.empty((H, W, 3), dtype=np.uint8)
                    rgb[:] = (19, 22, 30)

                capture_convert_end = time.perf_counter()
                stat_ms["convert"] += (capture_convert_end-capture_read_end)*1000.0
                stat_ms["camera"] += (capture_convert_end-t_camera)*1000.0
                t_blend = time.perf_counter()
                # Snapshot Preview only when the independent JPEG worker is
                # due; Program RGB is untouched until after cam.send().
                monitor_sample_time = time.monotonic()
                base_rgb = rgb.copy() if monitor_encoder is not None and monitor_encoder.needs_preview(monitor_sample_time) else None
                with lock:
                    overlay = state["overlay"]
                    preview_overlay = state["preview_overlay"]
                    preview_revision = state["preview_revision"]
                    browser_take_id = state["program_rendered_take_id"]
                    captures = state["captures"]
                    error = state["error"]
                    render_program_ms = state["render_program_ms"]
                    render_preview_ms = state["render_preview_ms"]
                    screenshot_program_ms = state["screenshot_program_ms"]
                    screenshot_preview_ms = state["screenshot_preview_ms"]
                    captures_preview = state["captures_preview"]
                    roi_program_area = state["roi_program_area"]
                    roi_preview_area = state["roi_preview_area"]

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
                blend_overlay_inplace(rgb, applied_overlay)

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
                # Every Program snapshot comes from a successfully sent Unity
                # frame; Preview uses its own pre-blend physical-frame copy.
                # Encoding and MJPEG HTTP fanout run on independent workers.
                if monitor_encoder is not None:
                    monitor_encoder.submit(
                        rgb, base_rgb, preview_overlay, monitor_sample_time,
                    )
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
                    elapsed_html = max(.001, now - last_status)
                    print(
                        f"STDQ_HTML program={(captures-last_html_captures)/elapsed_html:.1f}fps "
                        f"preview={(captures_preview-last_preview_captures)/elapsed_html:.1f}fps "
                        f"ROI={int(roi_program_area*100)}%/{int(roi_preview_area*100)}%",
                        flush=True,
                    )
                    last_html_captures = captures
                    last_preview_captures = captures_preview
                    if monitor_encoder is not None:
                        print(monitor_encoder.report(), flush=True)
                    if stat_frames:
                        print(
                            "STDQ_PERF "
                            + " ".join(f"{key}={value/stat_frames:.2f}ms" for key,value in stat_ms.items())
                            + f" html_program={render_program_ms:.1f}ms"
                            + f" html_preview={render_preview_ms:.1f}ms"
                            + f" screenshot_program={screenshot_program_ms:.1f}ms"
                            + f" screenshot_preview={screenshot_preview_ms:.1f}ms"
                            + f" capture_preview_total={captures_preview}"
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
        if monitor_encoder is not None:
            monitor_encoder.close()
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
