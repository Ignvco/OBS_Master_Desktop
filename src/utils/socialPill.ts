/** Social Pill V3.8: structured, non-destructive network data shared by editor and OBS. */
export const SOCIAL_PLATFORMS = [
  'instagram', 'youtube', 'spotify', 'facebook', 'tiktok', 'twitch', 'x', 'web', 'otro',
] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export interface SocialNetwork {
  id: string;
  platform: SocialPlatform;
  label: string;
  handle: string;
  iconAssetUrl?: string;
}
export const DEFAULT_SOCIAL_NETWORK: SocialNetwork = {
  id: 'instagram', platform: 'instagram', label: 'Instagram', handle: '@sitedijeraqueoficial',
};
export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram:'Instagram', youtube:'YouTube', spotify:'Spotify', facebook:'Facebook',
  tiktok:'TikTok', twitch:'Twitch', x:'X / Twitter', web:'Sitio web', otro:'Otro',
};
const validPlatform = (value: unknown): value is SocialPlatform =>
  typeof value === 'string' && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
const safeText = (value: unknown, fallback: string, max = 120) =>
  typeof value === 'string' ? value.slice(0, max) : fallback;

/** Old episode records with network objects remain readable; invalid string items are ignored. */
export function normalizeSocialNetworks(raw: unknown): SocialNetwork[] {
  if (!Array.isArray(raw)) return [DEFAULT_SOCIAL_NETWORK];
  const existing = new Set<string>();
  const normalized: SocialNetwork[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const value = entry as Record<string, unknown>;
    const platform = validPlatform(value.platform) ? value.platform : 'otro';
    let id = safeText(value.id, '', 64) || `${platform}-${index}`;
    if (existing.has(id)) id = `${id}-${index}`;
    existing.add(id);
    normalized.push({
      id, platform,
      label: safeText(value.label, SOCIAL_LABELS[platform], 64),
      handle: safeText(value.handle, '', 180),
      ...(typeof value.iconAssetUrl === 'string' && /^(\/|https?:\/\/)/.test(value.iconAssetUrl) ?
        {iconAssetUrl:value.iconAssetUrl.slice(0,2000)} : {}),
    });
    if (normalized.length >= 12) break;
  }
  return normalized.length ? normalized : [DEFAULT_SOCIAL_NETWORK];
}
export interface SocialPillContent {
  networks?: unknown;
  activeId?: string;
  activeNetwork?: string;
  rotationMode?: 'fixed' | 'rotate';
  rotationIntervalSeconds?: number;
  rotationEpochMs?: number;
  badgeText?: string;
  showBadge?: boolean;
}
export function socialPillNetworkAt(content: SocialPillContent, atMs: number): SocialNetwork {
  const networks = normalizeSocialNetworks(content.networks);
  if ((content.rotationMode === 'rotate' || (!content.rotationMode && Number(content.rotationIntervalSeconds) > 0)) && networks.length > 1) {
    const seconds = Number(content.rotationIntervalSeconds);
    const intervalMs = (Number.isFinite(seconds) ? Math.max(2, Math.min(120, seconds)) : 6) * 1000;
    const epoch = Number.isFinite(content.rotationEpochMs) ? Math.max(0, content.rotationEpochMs!) : 0;
    const index = Math.floor(Math.max(0, atMs - epoch) / intervalMs) % networks.length;
    return networks[index];
  }
  return networks.find(x => x.id === content.activeId) ?? networks.find(x => x.platform === content.activeNetwork) ?? networks[0];
}
