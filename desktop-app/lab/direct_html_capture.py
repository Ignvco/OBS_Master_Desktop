"""RC5C -- optional safe CDP screenshot backend for transparent HTML overlays.

This is NOT Page.startScreencast: that Chromium API has documented alpha
compositing limitations. It uses Page.captureScreenshot + an explicit
transparent background override, and keeps the existing Playwright screenshot
path available. Both paths return PNG bytes. The caller still performs the
Preview revision / Program take-id checks before and after each capture.
"""
import base64


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

    def open(self):
        if self.engine == "cdp":
            self.session = self.page.context.new_cdp_session(self.page)
            # Page.screenshot(omit_background=True) applies its own temporary
            # setting. A raw CDP screenshot requires a persistent override.
            self.session.send(
                "Emulation.setDefaultBackgroundColorOverride",
                {"color": {"r": 0, "g": 0, "b": 0, "a": 0}},
            )
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
        encoded = self.session.send(
            "Page.captureScreenshot",
            {
                "format": "png",
                "fromSurface": True,
                "captureBeyondViewport": False,
                "optimizeForSpeed": True,
            },
        )
        return base64.b64decode(encoded["data"], validate=True)

    def close(self):
        if self.session is not None:
            try:
                self.session.detach()
            finally:
                self.session = None
