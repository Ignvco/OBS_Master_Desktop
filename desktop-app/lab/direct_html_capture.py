"""RC5C -- optional safe CDP screenshot backend for transparent HTML overlays.

This is NOT Page.startScreencast: that Chromium API has documented alpha
compositing limitations. It uses Page.captureScreenshot + an explicit
transparent background override, and keeps the existing Playwright screenshot
path available. Both paths return PNG bytes. The caller still performs the
Preview revision / Program take-id checks before and after each capture.
"""
import base64
import struct


class HtmlFrameCapture:
    def __init__(self, page, engine="playwright", scale="device"):
        if engine not in ("playwright", "cdp"):
            raise ValueError("STDQ_DIRECT_HTML_ENGINE must be playwright or cdp")
        if scale not in ("css", "device"):
            raise ValueError("Screenshot scale must be css or device")
        self.page = page
        self.engine = engine
        self.scale = scale
        self.session = None
        self._clip = None
        self._expected = None

    def open(self):
        if self.engine == "cdp":
            self.session = self.page.context.new_cdp_session(self.page)
            # Page.screenshot(omit_background=True) applies its own temporary
            # setting. A raw CDP screenshot requires a persistent override.
            self.session.send(
                "Emulation.setDefaultBackgroundColorOverride",
                {"color": {"r": 0, "g": 0, "b": 0, "a": 0}},
            )
            viewport = self.page.viewport_size
            if viewport is None:
                raise RuntimeError("CDP requiere un viewport conocido")
            width, height = viewport["width"], viewport["height"]
            # Raw CDP Page.captureScreenshot ignores Playwright's
            # screenshot(scale="device") transformation: in the field it
            # returned 1920x1080 instead of the requested 1280x720.
            # Use Page.Viewport.clip.scale in CSS/DIP units, preserving the
            # entire authored stage rather than cropping its right edge.
            screenshot_factor = self.page.evaluate("window.devicePixelRatio") if self.scale == "device" else 1.0
            self._expected = (
                round(width * screenshot_factor),
                round(height * screenshot_factor),
            )
            self._clip = {
                "x": 0, "y": 0, "width": width, "height": height,
                "scale": screenshot_factor,
            }
        return self

    def screenshot(self):
        if self.engine == "playwright":
            return self.page.screenshot(
                type="png",
                omit_background=True,
                animations="allow",
                scale=self.scale,
                timeout=10000,
            )
        if self.session is None:
            raise RuntimeError("CDP capture session is not open")
        def request():
            encoded = self.session.send(
                "Page.captureScreenshot",
                {
                    "format": "png",
                    "fromSurface": True,
                    "captureBeyondViewport": False,
                    "optimizeForSpeed": True,
                    "clip": self._clip,
                },
            )
            return base64.b64decode(encoded["data"], validate=True)

        output = request()
        actual = self._png_size(output)
        if actual != self._expected:
            # Edge versions can apply Page.Viewport.scale differently.
            # Calibrate ONCE, using observed actual pixel dimensions and
            # retrying a scaled capture; do not resize PNG in Python.
            factor = self._expected[0] / max(1, actual[0])
            self._clip["scale"] *= factor
            output = request()
            actual = self._png_size(output)
        if actual != self._expected:
            raise RuntimeError(
                f"CDP entregó PNG {actual[0]}x{actual[1]}, "
                f"esperado {self._expected[0]}x{self._expected[1]}; "
                "captura detenida para proteger geometría y alpha"
            )
        return output

    @staticmethod
    def _png_size(data):
        # PNG IHDR dimensions allow verifying output size without decoding
        # the entire frame twice (the compositor does that once later).
        if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError("CDP no entregó un PNG válido")
        return struct.unpack(">II", data[16:24])

    def close(self):
        if self.session is not None:
            try:
                self.session.detach()
            finally:
                self.session = None
