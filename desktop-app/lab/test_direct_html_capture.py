"""RC5H: Validate opt-in HD HTML capture without changing the 1920 stage.

Run with the same Windows Direct Lab venv. Edge/Playwright is required only
for the screenshot geometry smoke test; no Unity/OBS/camera/network needed.
"""
import unittest

import cv2
import numpy as np
from playwright.sync_api import sync_playwright

from direct_graphics import W, H, RENDER_W, RENDER_H, html_capture_profile


class HtmlCaptureProfileTests(unittest.TestCase):
    def test_default_profile_preserves_previous_rc5m_behavior(self):
        program = html_capture_profile(1080, "program")
        preview = html_capture_profile(1080, "preview")
        self.assertEqual(program["viewport"], (1920, 1080))
        self.assertEqual(preview["viewport"], (1920, 1080))
        self.assertEqual(program["device_scale_factor"], 1)
        self.assertEqual(preview["screenshot_scale"], "css")
        self.assertEqual(program["interval"], 0.1)
        self.assertEqual(preview["interval"], 0.75)

    def test_720_mode_preserves_authored_stage_and_preview_marker(self):
        for channel in ("program", "preview"):
            with self.subTest(channel=channel):
                profile = html_capture_profile(720, channel)
                self.assertEqual(profile["viewport"], (RENDER_W, RENDER_H))
                self.assertAlmostEqual(profile["device_scale_factor"], 2 / 3)
                self.assertEqual(profile["screenshot_scale"], "device")
        self.assertEqual((RENDER_W, RENDER_H), (1920, 1080))

    def test_rejects_invalid_output_profile_and_unknown_channel(self):
        with self.assertRaises(ValueError):
            html_capture_profile(480, "program")
        with self.assertRaises(ValueError):
            html_capture_profile(720, "unrecognized")

    def test_edge_real_screenshot_retains_geometry_and_alpha(self):
        # Verifies scaling is applied to the outer stage without moving
        # authored children or flattening alpha into an opaque background.
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
                    page.set_content("""
                    <!doctype html>
                    <html><body style="background:transparent;margin:0">
                      <div data-direct-preview-revision="17" style="
                        position:fixed;inset:0;width:1920px;height:1080px;
                        background:transparent;overflow:hidden">
                        <div id="sample" style="
                          position:absolute;left:120px;top:90px;
                          width:300px;height:240px;background:rgb(230,20,35)">
                        </div>
                        <div style="position:absolute;left:1680px;top:780px;
                          width:160px;height:200px;background:rgb(20,100,230)"></div>
                      </div>
                    </body></html>
                    """)
                    rect = page.locator("#sample").bounding_box()
                    self.assertAlmostEqual(rect["x"], 120, delta=1)
                    self.assertAlmostEqual(rect["y"], 90, delta=1)
                    self.assertAlmostEqual(rect["width"], 300, delta=1)
                    self.assertAlmostEqual(rect["height"], 240, delta=1)
                    self.assertEqual(page.evaluate("innerWidth"), 1920)
                    self.assertEqual(page.evaluate("innerHeight"), 1080)
                    self.assertEqual(
                        page.locator("[data-direct-preview-revision]").get_attribute(
                            "data-direct-preview-revision"
                        ), "17"
                    )
                    data = page.screenshot(
                        type="png", omit_background=True, animations="allow",
                        scale=profile["screenshot_scale"],
                    )
                    image = cv2.imdecode(
                        np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED,
                    )
                    self.assertIsNotNone(image)
                    self.assertEqual(image.shape, (720, 1280, 4))
                    self.assertEqual(int(image[30, 30, 3]), 0, "Outside must be transparent")
                    self.assertGreater(int(image[100, 120, 2]), 200, "Red graphic visible")
                    self.assertEqual(int(image[100, 120, 3]), 255, "Opaque graphic retained")
                    self.assertGreater(int(image[550, 1150, 0]), 170, "Blue right graphic visible")
                finally:
                    context.close()
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
