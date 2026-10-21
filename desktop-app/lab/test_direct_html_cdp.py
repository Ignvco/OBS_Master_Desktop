"""RC5C: compare transparent browser screenshots with an animated ticker.

Run on Windows using the validated lab Python and Microsoft Edge. No camera,
Unity/StreamYard, localhost server or OBS MASTER process is needed.
This deliberately fails if CDP loses true PNG alpha or returns wrong dimensions;
never replace alpha with a green/black chroma key.
"""
import time
import unittest

import cv2
import numpy as np
from playwright.sync_api import sync_playwright

from direct_graphics import W, H, RENDER_W, RENDER_H, html_capture_profile
from direct_html_capture import HtmlFrameCapture


TEST_PAGE = """
<!doctype html><html><head><style>
html,body {margin:0;width:100%;height:100%;background:transparent;overflow:hidden}
main {width:1920px;height:1080px;position:fixed;top:0;left:0;background:transparent}
#solid {position:absolute;left:120px;top:90px;width:300px;height:240px;background:rgb(230,20,35)}
#alpha {position:absolute;left:450px;top:200px;width:240px;height:180px;background:rgba(40,130,220,.5)}
#ticker {position:absolute;left:0;top:720px;height:120px;width:1200px;
  background:linear-gradient(90deg,#ff6600 0%,#ff6600 30%,#1b91cc 60%,#ff6600 100%);
  animation:slide 2.3s linear infinite alternate}
@keyframes slide {from {transform:translateX(-250px)} to {transform:translateX(450px)}}
</style></head><body><main data-direct-preview-revision="16">
<div id="solid"></div><div id="alpha"></div><div id="ticker"></div>
</main></body></html>
"""


def validate_png(payload):
    image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise AssertionError("PNG no se pudo decodificar")
    if image.shape != (H, W, 4):
        raise AssertionError(f"PNG esperado {(H, W, 4)}, recibido {image.shape}")
    if int(image[20, 20, 3]) != 0:
        raise AssertionError("El fondo NO es transparente, alpha perdido")
    # Solid area CSS at (120,90), width 300, height 240; at 2/3 device scale
    if int(image[100, 100, 3]) != 255 or int(image[100, 100, 2]) < 200:
        raise AssertionError("La capa sólida perdió coordenadas o color")
    # Semitransparent rectangle CSS at (450,200).
    if not 90 <= int(image[180, 330, 3]) <= 170:
        raise AssertionError("La capa translúcida no retuvo alfa ~128")
    return image


class HtmlCDPBenchTests(unittest.TestCase):
    def test_invalid_backend_is_rejected(self):
        with self.assertRaises(ValueError):
            HtmlFrameCapture(None, engine="screencast")
        with self.assertRaises(ValueError):
            HtmlFrameCapture(None, scale="invalid")

    def test_edge_720_png_transparency_and_ticker(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge", headless=True)
            try:
                profile = html_capture_profile(720, "preview")
                context = browser.new_context(
                    viewport={"width": RENDER_W, "height": RENDER_H},
                    device_scale_factor=profile["device_scale_factor"],
                )
                try:
                    page = context.new_page()
                    page.set_content(TEST_PAGE)
                    self.assertEqual(page.evaluate("innerWidth"), 1920)
                    self.assertEqual(page.evaluate("innerHeight"), 1080)
                    for engine in ("playwright", "cdp"):
                        with self.subTest(engine=engine):
                            capture = HtmlFrameCapture(
                                page, engine=engine, scale=profile["screenshot_scale"]
                            ).open()
                            try:
                                times = []
                                moving = []
                                for i in range(12):
                                    started = time.perf_counter()
                                    data = capture.screenshot()
                                    times.append((time.perf_counter() - started) * 1000)
                                    img = validate_png(data)
                                    # Crop only the animated ticker region. A
                                    # fully static screencast cannot pass this.
                                    moving.append(img[480:555].copy())
                                    page.wait_for_timeout(25)
                                changes = sum(
                                    int(np.count_nonzero(moving[i] != moving[i - 1]))
                                    for i in range(1, len(moving))
                                )
                                self.assertGreater(changes, 200,
                                    f"{engine}: ticker dejó de animarse")
                                print(
                                    f"RC5C_BENCH engine={engine} "
                                    f"mean={sum(times)/len(times):.1f}ms "
                                    f"min={min(times):.1f}ms max={max(times):.1f}ms "
                                    f"frames={len(times)} ticker_changes={changes}",
                                    flush=True,
                                )
                            finally:
                                capture.close()
                finally:
                    context.close()
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
