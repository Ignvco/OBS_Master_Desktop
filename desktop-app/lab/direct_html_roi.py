"""Experimental Playwright partial screenshot geometry for OBS MASTER RC5R.

The React stage remains 1920x1080 CSS. The browser computes a conservative
union of all actual visible DOM bounds; Python adds margins, snaps coordinates
to exact 720p device pixels and only clips when the area saving is material.

No chroma key, no CDP, no changes to Unity Camera, no scene publication
through this helper. If geometry is uncertain, callers take the FULL frame.
"""

import math

STAGE_W = 1920
STAGE_H = 1080
PIXEL_W = 1280
PIXEL_H = 720
SCALE = PIXEL_W / STAGE_W

# React's main DirectCompositeRenderer root contains one Motion.div for each
# graphic. Include descendants because Motion transforms can move text, masks,
# or ribbons beyond the nominal graphic box. If too many elements exist,
# simply fall back to a full screenshot to protect graphic fidelity.
STAGE_BOUNDS_JS = r"""(root, markerName) => {
  const marker = root.getAttribute(markerName);
  const children = Array.from(root.children);
  if (children.length === 0)
    return {marker, empty: true, bounds: null};
  if (children.length > 30)
    return {marker, empty: false, bounds: null};
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  let seen = 0;
  for (const child of children) {
    const elements = [child, ...child.querySelectorAll('*')];
    seen += elements.length;
    if (seen > 500)
      return {marker, empty: false, bounds: null};
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right))
        return {marker, empty: false, bounds: null};
      if (rect.width <= 0 || rect.height <= 0)
        continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }
  }
  if (!Number.isFinite(left) || !Number.isFinite(top))
    return {marker, empty: false, bounds: null};
  return {marker, empty: false, bounds: [left, top, right, bottom]};
}"""


def roi_plan(metadata, margin=72, max_area_fraction=0.72):
    """Return (clip_or_None, empty).

    Clip coordinates are CSS pixels; quantization at 3 CSS pixels makes
    screenshot(scale='device', DPR=2/3) land on integer device pixels.
    Clip=None means FULL frame fallback. Empty=True means no graphics.
    """
    if not isinstance(metadata, dict):
        return None, False
    if metadata.get("empty") is True:
        return None, True
    bounds = metadata.get("bounds")
    if not isinstance(bounds, (tuple, list)) or len(bounds) != 4:
        return None, False
    try:
        left, top, right, bottom = [float(v) for v in bounds]
    except (ValueError, TypeError):
        return None, False
    if not all(math.isfinite(v) for v in (left, top, right, bottom)):
        return None, False
    if right <= left or bottom <= top:
        return None, False
    if right + margin <= 0 or left - margin >= STAGE_W:
        return None, True
    if bottom + margin <= 0 or top - margin >= STAGE_H:
        return None, True

    # Outward quantization retains shadows and all transformed edges.
    snap = 3
    x0 = max(0, snap * math.floor((left - margin) / snap))
    y0 = max(0, snap * math.floor((top - margin) / snap))
    x1 = min(STAGE_W, snap * math.ceil((right + margin) / snap))
    y1 = min(STAGE_H, snap * math.ceil((bottom + margin) / snap))
    width, height = int(x1 - x0), int(y1 - y0)
    if width <= 0 or height <= 0:
        return None, True
    fraction = (width * height) / (STAGE_W * STAGE_H)
    if fraction >= max_area_fraction:
        return None, False
    return {
        "x": int(x0), "y": int(y0),
        "width": width, "height": height,
    }, False


def to_pixels(clip):
    """(x,y,width,height) integer positions in 1280x720 output."""
    values = (
        clip["x"], clip["y"], clip["width"], clip["height"],
    )
    scaled = [round(value * SCALE) for value in values]
    x, y, width, height = scaled
    if (
        x < 0 or y < 0 or width <= 0 or height <= 0
        or x + width > PIXEL_W or y + height > PIXEL_H
    ):
        raise ValueError("ROI fuera de límites del lienzo 1280x720")
    return x, y, width, height
