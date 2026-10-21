/** Canvas coordinates are always in OBS pixels, regardless of preview zoom or Windows DPI. */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export interface Box { x: number; y: number; width: number; height: number; scale: number }
export const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : low, low), Math.max(low, high));

export function moveBox(start: Box, dxClient: number, dyClient: number, viewportWidth: number): Box {
  const factor = CANVAS_WIDTH / Math.max(1, viewportWidth);
  return {
    ...start,
    x: Math.round(clamp(start.x + dxClient * factor, 0, CANVAS_WIDTH - start.width * start.scale)),
    y: Math.round(clamp(start.y + dyClient * factor, 0, CANVAS_HEIGHT - start.height * start.scale)),
  };
}
export function resizeBox(start: Box, dxClient: number, dyClient: number, viewportWidth: number): Box {
  const factor = CANVAS_WIDTH / Math.max(1, viewportWidth);
  const maxW = Math.max(80, (CANVAS_WIDTH - start.x) / Math.max(0.1, start.scale));
  const maxH = Math.max(48, (CANVAS_HEIGHT - start.y) / Math.max(0.1, start.scale));
  return {
    ...start,
    width: Math.round(clamp(start.width + dxClient * factor / Math.max(0.1,start.scale), 80, maxW)),
    height: Math.round(clamp(start.height + dyClient * factor / Math.max(0.1,start.scale), 48, maxH)),
  };
}
