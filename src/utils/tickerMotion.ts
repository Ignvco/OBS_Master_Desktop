/** Shared between inspector and Browser Source. No CSS framework dependency. */
export const DEFAULT_TICKER_SECONDS = 35;
export type TickerDirection = 'left' | 'right';
export function sanitizeTickerItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is string => typeof item === 'string')
    .map(item => item.trim()).filter(Boolean).slice(0, 50);
}
export function tickerSeconds(value: unknown, fallback = DEFAULT_TICKER_SECONDS): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(8, Math.min(180, n)) : fallback;
}
export function tickerDirection(value: unknown): TickerDirection {
  return value === 'right' ? 'right' : 'left';
}
export function tickerLoopWidth(cycleWidth: number): number {
  return Number.isFinite(cycleWidth) ? Math.max(0, cycleWidth) : 0;
}
