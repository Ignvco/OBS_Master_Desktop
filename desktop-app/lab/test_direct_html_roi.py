"""RC5R offline safety/visual tests for opt-in Playwright region capture.

Requires only the existing Windows Direct Lab venv and Microsoft Edge.
Does not open camera, Unity, StreamYard, OBS MASTER or local services.
"""
import time
import unittest
import numpy as np
import cv2
from playwright.sync_api import sync_playwright

from direct_html_roi import (
    STAGE_BOUNDS_JS, roi_plan, to_pixels, STAGE_W, STAGE_H, PIXEL_W, PIXEL_H,
)

HTML = """
<!DOCTYPE html><html><head><style>
html,body {margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
.stage{position:fixed;left:0;top:0;width:1920px;height:1080px;overflow:hidden}
.graphic{position:absolute;left:200px;top:715px;width:1380px;height:260px;}
.ribbon{position:absolute;left:0;top:15px;width:1370px;height:130px;
 background:linear-gradient(90deg,#f70 0%,#ff9700 50%,#f70 100%);
 animation:marquee 3s ease-in-out infinite alternate}
.mask{position:absolute;left:90px;top:70px;width:450px;height:90px;
 border-radius:24px;background:rgba(20,120,210,.6)}
.letter{position:absolute;left:150px;top:82px;font:900 70px Arial;
 color:rgba(255,255,255,.92);letter-spacing:-2px}
@keyframes marquee {from{transform:translateX(-70px)}to{transform:translateX(70px)}}
</style></head><body>
<main class="stage" data-direct-preview-revision="8">
<div class="graphic"><div class="ribbon"></div><div class="mask"></div>
<div class="letter">SI TE DIJERA QUE?</div></div>
</main></body></html>
"""


def decode_png(data):
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise AssertionError("PNG did not decode")
    return image


class GeometryTests(unittest.TestCase):
    def test_small_graphic_returns_aligned_roi(self):
        clip, empty = roi_plan({"bounds": [200, 720, 1500, 980], "empty": False})
        self.assertFalse(empty)
        self.assertIsNotNone(clip)
        self.assertEqual(clip["x"] % 3, 0)
        self.assertEqual(clip["y"] % 3, 0)
        self.assertEqual(clip["width"] % 3, 0)
        self.assertEqual(clip["height"] % 3, 0)
        x, y, w, h = to_pixels(clip)
        self.assertLess(x, 200 * (2 / 3))
        self.assertLess(y, 720 * (2 / 3))
        self.assertLess(w * h, PIXEL_W * PIXEL_H * .72)

    def test_empty_and_large_scenes_use_safe_paths(self):
        self.assertEqual(roi_plan({"empty": True, "bounds": None}), (None, True))
        self.assertEqual(roi_plan({"empty": False, "bounds": None}), (None, False))
        self.assertEqual(roi_plan({"empty": False, "bounds": [0, 0, 1920, 1080]}), (None, False))
        self.assertEqual(roi_plan({"empty": False, "bounds": [-500, 0, -400, 70]}), (None, True))
        self.assertEqual(roi_plan({"empty": False, "bounds": [0, 0, float('nan'), 100]}), (None, False))

    def test_edge_full_vs_roi_equal_alpha_and_ticker_motion(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="msedge", headless=True)
            try:
                context = browser.new_context(
                    viewport={"width": STAGE_W, "height": STAGE_H},
                    device_scale_factor=2 / 3,
                )
                try:
                    page = context.new_page()
                    page.set_content(HTML)
                    self.assertEqual(page.evaluate("innerWidth"), STAGE_W)
                    self.assertEqual(page.evaluate("innerHeight"), STAGE_H)
                    # Pause movement to get two pixel-identical snapshots.
                    page.add_style_tag(content="*{animation-play-state:paused!important}")
                    root = page.locator("[data-direct-preview-revision]")
                    meta = root.evaluate(STAGE_BOUNDS_JS, "data-direct-preview-revision")
                    self.assertEqual(meta["marker"], "8")
                    clip, empty = roi_plan(meta)
                    self.assertFalse(empty)
                    self.assertIsNotNone(clip, "Ticker should qualify for ROI")

                    opts = dict(type="png", omit_background=True, animations="allow",
                                scale="device", timeout=10000)
                    full = decode_png(page.screenshot(**opts))
                    partial = decode_png(page.screenshot(clip=clip, **opts))
                    x, y, w, h = to_pixels(clip)
                    self.assertEqual(full.shape, (PIXEL_H, PIXEL_W, 4))
                    self.assertEqual(partial.shape, (h, w, 4))
                    stitched = np.zeros_like(full)
                    stitched[y:y+h, x:x+w] = partial
                    diff = np.abs(stitched.astype(np.int16)-full.astype(np.int16))
                    self.assertLessEqual(int(diff.max()), 2,
                        "ROI visual output must match full alpha screenshot")
                    self.assertEqual(int(stitched[50, 50, 3]), 0)
                    self.assertTrue(bool(np.any((stitched[:,:,3] > 0)&(stitched[:,:,3] < 255))))

                    # Re-enable the ticker and benchmark BOTH methods in the
                    # same Edge context. This is diagnostic, not an assertion
                    # that clipping is faster on every Windows installation.
                    page.add_style_tag(content="*{animation-play-state:running!important}")
                    full_ms, roi_ms = [], []
                    frames = []
                    for i in range(10):
                        for key, output in (("full", full_ms), ("roi", roi_ms)):
                            t = time.perf_counter()
                            payload = page.screenshot(
                                clip=clip if key == "roi" else None, **opts
                            )
                            output.append((time.perf_counter() - t) * 1000)
                            if key == "roi":
                                frames.append(decode_png(payload))
                    changes = sum(int(np.count_nonzero(a!=b))
                                  for a,b in zip(frames[:-1], frames[1:]))
                    self.assertGreater(changes, 200, "Ticker animation did not move")
                    print(
                        f"RC5R_BENCH full_mean={sum(full_ms)/len(full_ms):.1f}ms "
                        f"roi_mean={sum(roi_ms)/len(roi_ms):.1f}ms "
                        f"clip={clip['width']}x{clip['height']} CSS "
                        f"ticker_changes={changes}", flush=True,
                    )
                finally:
                    context.close()
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
