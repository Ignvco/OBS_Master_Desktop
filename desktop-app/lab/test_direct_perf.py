"""Offline equivalence checks for the optimized Direct compositor.

Run with the Windows Direct Lab Python venv:
  python desktop-app/lab/test_direct_perf.py
No webcam, Unity driver, StreamYard or OBS Master process is required.
"""
import unittest
import numpy as np
from direct_graphics import compile_overlay, blend_overlay_inplace


class FastBlendTests(unittest.TestCase):
    def test_transparent_overlay_never_changes_frame(self):
        base = np.random.default_rng(15).integers(0, 256, (96, 160, 3), dtype=np.uint8)
        rgba = np.zeros((96, 160, 4), dtype=np.uint8)
        overlay = compile_overlay(rgba)
        self.assertIsNone(overlay[2], "Fully transparent overlay must have no work to blend")
        actual = blend_overlay_inplace(base.copy(), overlay)
        np.testing.assert_array_equal(actual, base)

    def test_opaque_overlay_is_exact(self):
        base = np.zeros((48, 64, 3), dtype=np.uint8)
        rgba = np.zeros((48, 64, 4), dtype=np.uint8)
        rgba[5:28, 12:41, :3] = (255, 84, 4)
        rgba[5:28, 12:41, 3] = 255
        compiled = compile_overlay(rgba)
        self.assertEqual(compiled[:2], (12, 5))
        result = blend_overlay_inplace(base, compiled)
        np.testing.assert_array_equal(result[5:28, 12:41], rgba[5:28, 12:41, :3])
        self.assertEqual(int(np.count_nonzero(result[:5])), 0)

    def test_alpha_matches_float_compositor_with_one_code_value_tolerance(self):
        generator = np.random.default_rng(26)
        base = generator.integers(0, 256, (180, 320, 3), dtype=np.uint8)
        rgba = np.zeros((180, 320, 4), dtype=np.uint8)
        rgba[21:163, 29:281, :3] = generator.integers(
            0, 256, (142, 252, 3), dtype=np.uint8
        )
        rgba[21:163, 29:281, 3] = generator.integers(
            0, 256, (142, 252), dtype=np.uint8
        )
        alpha = rgba[:, :, 3:4].astype(np.float32) / 255.0
        old_float = np.clip(
            base.astype(np.float32) * (1.0 - alpha)
            + rgba[:, :, :3].astype(np.float32) * alpha,
            0, 255,
        ).astype(np.uint8)
        new_uint8 = blend_overlay_inplace(base.copy(), compile_overlay(rgba))
        maximum = int(np.abs(old_float.astype(np.int16) - new_uint8.astype(np.int16)).max())
        self.assertLessEqual(maximum, 2, f"Unexpected alpha color difference: {maximum}")

    def test_compiled_preview_is_independent_of_program(self):
        source = np.zeros((24, 48, 3), dtype=np.uint8)
        source[:,:,:] = (40, 50, 60)
        preview = np.zeros((24, 48, 4), dtype=np.uint8)
        preview[1:10, 2:15] = (250, 200, 20, 255)
        program = source.copy()
        prepared = blend_overlay_inplace(source.copy(), compile_overlay(preview))
        np.testing.assert_array_equal(program, source)
        self.assertNotEqual(prepared.tobytes(), program.tobytes())


if __name__ == '__main__':
    unittest.main(verbosity=2)
