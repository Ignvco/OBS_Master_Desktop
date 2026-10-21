"""Non-blocking, latest-frame JPEG monitors for the native Unity output.

The ONLY on-air thread calls pyvirtualcam.Camera.send(). This module never
calls the camera, changes Preview selection, or touches Take acknowledgments.
Both channels have at most one pending frame: slow viewers or JPEG encoders
drop obsolete snapshots instead of increasing latency or backpressuring air.
"""
import threading
import time

import cv2
import numpy as np


class _LatestFrameChannel:
    def __init__(self, name, monitor, encode, fps, jpeg_quality, size, stop_event, blend=None):
        self.name = name
        self.monitor = monitor
        self.encode = encode
        self.interval = 1.0 / fps
        self.jpeg_quality = jpeg_quality
        self.size = size
        self.stop_event = stop_event
        self.blend = blend
        self.condition = threading.Condition()
        self.pending = None
        self.next_due = 0.0
        self.closed = False
        self.offered = 0
        self.encoded = 0
        self.dropped = 0
        self.errors = 0
        self.thread = threading.Thread(
            target=self._run, daemon=True, name=f"OBS-MASTER-JPEG-{name}"
        )

    def start(self):
        self.thread.start()

    def is_due(self, timestamp):
        # Called only by the single camera output thread.
        return not self.closed and timestamp >= self.next_due

    def offer(self, frame, overlay=None, timestamp=None):
        timestamp = time.monotonic() if timestamp is None else timestamp
        with self.condition:
            if self.closed or timestamp < self.next_due:
                return False
            self.next_due = timestamp + self.interval
            if self.pending is not None:
                self.dropped += 1
            self.pending = (frame, overlay)
            self.offered += 1
            self.condition.notify()
            return True

    def _run(self):
        try:
            while not self.stop_event.is_set():
                with self.condition:
                    self.condition.wait_for(
                        lambda: self.closed or self.stop_event.is_set()
                        or self.pending is not None,
                        timeout=0.35,
                    )
                    if self.closed or self.stop_event.is_set():
                        break
                    if self.pending is None:
                        continue
                    frame, overlay = self.pending
                    self.pending = None
                try:
                    if overlay is not None:
                        # Preview owns an independent uncomposited camera buffer.
                        # The graphic snapshot is immutable after publication.
                        frame = self.blend(frame, overlay)
                    small = cv2.resize(
                        frame, self.size, interpolation=cv2.INTER_AREA
                    )
                    bgr = cv2.cvtColor(small, cv2.COLOR_RGB2BGR)
                    ok, jpeg = cv2.imencode(
                        ".jpg", bgr,
                        [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality],
                    )
                    if ok:
                        self.encode(jpeg.tobytes())
                        self.encoded += 1
                    else:
                        self.errors += 1
                except (cv2.error, ValueError, RuntimeError) as exc:
                    self.errors += 1
                    if self.errors < 4:
                        print(f"MONITOR {self.name}: {exc}", flush=True)
        finally:
            with self.condition:
                self.pending = None

    def stats(self):
        return (
            f"{self.name}: encoded={self.encoded} "
            f"offered={self.offered} dropped={self.dropped} "
            f"errors={self.errors}"
        )

    def close(self):
        with self.condition:
            self.closed = True
            self.pending = None
            self.condition.notify_all()
        self.thread.join(timeout=4)


class AsyncMonitorEncoder:
    """Independent JPEG encoders, bounded latest-frame queue per monitor.

    RGB frames must not be mutated after they are offered. Program frames are
    offered AFTER successful cam.send. Preview's frame must be copied BEFORE
    Program overlay is drawn and is composited only in its own worker thread.
    """
    def __init__(self, monitor, stop_event, blend, fps=15, quality=68,
                 size=(640, 360)):
        if not 1 <= fps <= 30:
            raise ValueError("Monitor FPS must be 1..30")
        if not 40 <= quality <= 95:
            raise ValueError("Monitor JPEG quality must be 40..95")
        self.program = _LatestFrameChannel(
            "program", monitor, monitor.publish, fps, quality, size, stop_event
        )
        self.preview = _LatestFrameChannel(
            "preview", monitor, monitor.publish_preview, fps, quality, size,
            stop_event, blend=blend,
        )
        self._last_report_at = time.monotonic()
        self._last_program_encoded = 0
        self._last_preview_encoded = 0

    def start(self):
        self.program.start()
        self.preview.start()

    def needs_preview(self, timestamp):
        return self.preview.is_due(timestamp)

    def submit(self, program_rgb, base_rgb, preview_overlay, timestamp):
        # Called AFTER cam.send (real program frame). A skipped JPEG never
        # reduces output FPS, and a slow encoder has no growing frame queue.
        self.program.offer(program_rgb, timestamp=timestamp)
        if base_rgb is not None:
            self.preview.offer(base_rgb, preview_overlay, timestamp)

    def report(self):
        now = time.monotonic()
        elapsed = max(0.001, now - self._last_report_at)
        program_delta = self.program.encoded - self._last_program_encoded
        preview_delta = self.preview.encoded - self._last_preview_encoded
        self._last_report_at = now
        self._last_program_encoded = self.program.encoded
        self._last_preview_encoded = self.preview.encoded
        return (
            f"STDQ_MONITOR program={program_delta/elapsed:.1f}fps "
            f"preview={preview_delta/elapsed:.1f}fps "
            f"| {self.program.stats()} | {self.preview.stats()}"
        )

    def close(self):
        self.program.close()
        self.preview.close()
