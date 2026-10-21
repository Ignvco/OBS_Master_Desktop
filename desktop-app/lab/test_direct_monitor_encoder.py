"""Offline safety tests: independent latest-frame MJPEG pipelines.

Run with the Direct Lab Python virtual environment; no camera, Electron,
network, OBS Master or Unity Capture device is necessary.
"""
import threading
import time
import math
import unittest

import cv2
import numpy as np

from direct_monitor_encoder import AsyncMonitorEncoder, _LatestFrameChannel


class FakeMonitor:
    def __init__(self):
        self.program = []
        self.preview = []
        self.lock = threading.Lock()

    def publish(self, data):
        with self.lock:
            self.program.append(data)

    def publish_preview(self, data):
        with self.lock:
            self.preview.append(data)


class AsyncMonitorTests(unittest.TestCase):
    def test_preview_isolation_and_independent_encoding(self):
        monitor = FakeMonitor()
        stop = threading.Event()

        def paint_preview(frame, overlay):
            frame[:, :, :] = overlay
            return frame

        pipeline = AsyncMonitorEncoder(
            monitor, stop, paint_preview, fps=15, quality=90, size=(64, 36),
        )
        pipeline.start()
        try:
            program = np.zeros((72, 128, 3), dtype=np.uint8)
            program[:, :, :] = (230, 30, 20)  # RGB: bright red
            webcam = np.zeros((72, 128, 3), dtype=np.uint8)
            webcam[:, :, :] = (30, 180, 30)  # RGB: green
            preview_color = (35, 45, 240)    # RGB: bright blue
            now = time.monotonic()
            pipeline.submit(program, webcam, preview_color, now)
            for _ in range(100):
                with monitor.lock:
                    ready = bool(monitor.program and monitor.preview)
                if ready:
                    break
                time.sleep(0.02)
            with monitor.lock:
                self.assertTrue(monitor.program, "Program worker must publish")
                self.assertTrue(monitor.preview, "Preview worker must publish")
                program_jpeg = monitor.program[-1]
                preview_jpeg = monitor.preview[-1]

            decoded_program = cv2.imdecode(
                np.frombuffer(program_jpeg, np.uint8), cv2.IMREAD_COLOR
            )
            decoded_preview = cv2.imdecode(
                np.frombuffer(preview_jpeg, np.uint8), cv2.IMREAD_COLOR
            )
            self.assertIsNotNone(decoded_program)
            self.assertIsNotNone(decoded_preview)
            # JPEG decoder gives BGR; compare robustly (JPEG is lossy).
            self.assertGreater(int(decoded_program[10, 10, 2]), 200)
            self.assertGreater(int(decoded_preview[10, 10, 0]), 200)
            np.testing.assert_array_equal(program[0, 0], (230, 30, 20))
            np.testing.assert_array_equal(webcam[0, 0], preview_color)
        finally:
            pipeline.close()
            stop.set()
        self.assertFalse(pipeline.program.thread.is_alive())
        self.assertFalse(pipeline.preview.thread.is_alive())

    def test_overwrite_old_pending_frames_without_unbounded_queue(self):
        entered = threading.Event()
        release = threading.Event()
        output = []

        def slow_encode(data):
            entered.set()
            release.wait(timeout=2)
            output.append(data)

        channel = _LatestFrameChannel(
            "fake", None, slow_encode, fps=30, jpeg_quality=70,
            size=(32, 18), stop_event=threading.Event(),
        )
        channel.start()
        try:
            original = np.zeros((18, 32, 3), np.uint8)
            self.assertTrue(channel.offer(original, timestamp=100))
            self.assertTrue(entered.wait(timeout=2))
            for index in range(1, 31):
                frame = np.full((18, 32, 3), index, np.uint8)
                self.assertTrue(channel.offer(frame, timestamp=100 + index))
            self.assertLessEqual(len(output), 1)
            self.assertEqual(channel.offered, 31)
            self.assertEqual(channel.dropped, 29, "Only one pending image is retained")
            self.assertIsNotNone(channel.pending)
            release.set()
            deadline = time.monotonic() + 2
            while channel.encoded < 2 and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertEqual(channel.encoded, 2, "Initial and newest frame only")
            self.assertEqual(len(output), 2)
        finally:
            release.set()
            channel.close()
        self.assertFalse(channel.thread.is_alive())

    def test_phase_locked_scheduler_preserves_15fps_under_30hz_jitter(self):
        """Previously this aliasing produced ~11.6fps with zero drops."""
        channel = _LatestFrameChannel(
            "timing", None, lambda _: None, fps=15, jpeg_quality=70,
            size=(64, 36), stop_event=threading.Event(),
        )
        # Deterministic timestamps, no live thread or camera required.
        frame = np.zeros((8, 8, 3), np.uint8)
        for i in range(600):
            timestamp = 100.0 + i / 30.0 + math.sin(i * 0.77) * 0.002
            channel.offer(frame, timestamp=timestamp)
        self.assertGreaterEqual(channel.offered, 295)
        self.assertLessEqual(channel.offered, 301)
        self.assertEqual(channel.errors, 0)

    def test_phase_locked_scheduler_skips_missed_deadlines_after_pause(self):
        channel = _LatestFrameChannel(
            "timing", None, lambda _: None, fps=15, jpeg_quality=70,
            size=(64, 36), stop_event=threading.Event(),
        )
        frame = np.zeros((8, 8, 3), np.uint8)
        self.assertTrue(channel.offer(frame, timestamp=100))
        self.assertTrue(channel.offer(frame, timestamp=101))
        self.assertFalse(channel.offer(frame, timestamp=101.001))
        self.assertTrue(channel.offer(frame, timestamp=101.068))
        self.assertEqual(channel.offered, 3)

    def test_offer_rate_limit_and_stop(self):
        monitor = FakeMonitor()
        stop = threading.Event()
        pipe = AsyncMonitorEncoder(monitor, stop, lambda f, _: f, fps=15)
        pipe.start()
        try:
            t = time.monotonic()
            frame = np.zeros((32, 64, 3), np.uint8)
            pipe.submit(frame, frame.copy(), None, t)
            pipe.submit(frame, frame.copy(), None, t + 0.001)
            self.assertEqual(pipe.program.offered, 1)
            self.assertEqual(pipe.preview.offered, 1)
        finally:
            stop.set()
            pipe.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
