"""Read-only video monitor for the REAL Unity Capture program frames.

Frames are published only after a successful cam.send() and served over loopback.
Access requires a per-launch token provided by the parent Electron process.
The monitor never controls the camera, scenes, or Playwright.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import time


class ProgramMonitor:
    def __init__(self, token, port=31311):
        if not token:
            raise RuntimeError("Monitor token is required")
        self.token = token
        self.port = port
        self.condition = threading.Condition()
        self.frame = None
        self.sequence = 0
        self.server = None
        self.thread = None
        self.stopping = False

    def publish(self, frame):
        if not frame:
            return
        with self.condition:
            self.frame = frame
            self.sequence += 1
            self.condition.notify_all()

    def start(self):
        monitor = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                return

            def do_GET(self):
                if self.headers.get("X-Direct-Monitor-Token") != monitor.token:
                    self.send_error(403)
                    return
                if self.path == "/program.jpg":
                    with monitor.condition:
                        frame = monitor.frame
                    if not frame:
                        self.send_error(503)
                        return
                    self.send_response(200)
                    self.send_header("Content-Type", "image/jpeg")
                    self.send_header("Content-Length", str(len(frame)))
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.end_headers()
                    self.wfile.write(frame)
                    return
                if self.path != "/program.mjpg":
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                last = 0
                try:
                    while not monitor.stopping:
                        with monitor.condition:
                            monitor.condition.wait_for(
                                lambda: monitor.stopping or monitor.sequence > last,
                                timeout=2,
                            )
                            if monitor.stopping:
                                break
                            if monitor.sequence <= last:
                                continue
                            last = monitor.sequence
                            frame = monitor.frame
                        if frame is None:
                            continue
                        self.wfile.write(
                            b"--frame\r\nContent-Type: image/jpeg\r\n"
                            + b"Content-Length: " + str(len(frame)).encode() + b"\r\n\r\n"
                            + frame + b"\r\n"
                        )
                        self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                    pass

        self.server = ThreadingHTTPServer(("127.0.0.1", self.port), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(
            target=self.server.serve_forever, daemon=True, name="Direct-Program-Monitor"
        )
        self.thread.start()

    def close(self):
        self.stopping = True
        with self.condition:
            self.condition.notify_all()
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.thread:
            self.thread.join(timeout=3)
