import type { EpisodeData, LibraryCatalog, LibrarySettings, MediaAsset } from '../types';

export const DEFAULT_LIBRARY_SETTINGS: LibrarySettings = {
  startTab: 'episodes', assetView: 'grid', confirmDeletion: true, backupBeforeSwitch: true,
};

export function emptyLibrary(): LibraryCatalog {
  return { version: 1, episodes: [], assets: [], settings: { ...DEFAULT_LIBRARY_SETTINGS } };
}

export function isEpisode(value: unknown): value is EpisodeData {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<EpisodeData>;
  return typeof e.id === 'string' && e.id.length > 0 && e.id.length < 160 &&
    Number.isSafeInteger(e.number) && Number(e.number) >= 0 &&
    typeof e.title === 'string' && e.title.trim().length > 0 && e.title.length <= 240 &&
    typeof e.subtitle === 'string' && typeof e.date === 'string' &&
    typeof e.description === 'string' && Array.isArray(e.rundown) && Array.isArray(e.hosts) &&
    Array.isArray(e.tags) && Array.isArray(e.phrases) && Array.isArray(e.questions) &&
    Array.isArray(e.scriptures) && Array.isArray(e.quotes) && Array.isArray(e.tickerNews);
}

export function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<MediaAsset>;
  return typeof a.id === 'string' && a.id.length > 0 && a.id.length < 150 &&
    typeof a.name === 'string' && a.name.length > 0 && a.name.length < 250 &&
    ['video','image','audio','svg'].includes(String(a.type)) && typeof a.url === 'string' &&
    (/^\/api\/station\/media\/[0-9a-f-]{36}\.(png|jpg|webp|mp4|webm|mp3|wav)$/.test(a.url) ||
      a.url === '/assets/stdq-logo-oficial.png') &&
    typeof a.uploadedAt === 'string' && (a.notes === undefined || (typeof a.notes === 'string' && a.notes.length <= 1000)) &&
    (a.tags === undefined || (Array.isArray(a.tags) && a.tags.length <= 20 && a.tags.every(t => typeof t === 'string' && t.length <= 60)));
}

export function validSettings(settings: unknown): settings is LibrarySettings {
  if (!settings || typeof settings !== 'object') return false;
  const s = settings as LibrarySettings;
  return ['episodes','assets','backups'].includes(s.startTab) &&
    ['grid','list'].includes(s.assetView) && typeof s.confirmDeletion === 'boolean' &&
    typeof s.backupBeforeSwitch === 'boolean';
}

export function isLibrary(value: unknown): value is LibraryCatalog {
  if (!value || typeof value !== 'object') return false;
  const l = value as LibraryCatalog;
  return l.version === 1 && Array.isArray(l.episodes) && l.episodes.length <= 1000 &&
    l.episodes.every(isEpisode) && new Set(l.episodes.map(e => e.id)).size === l.episodes.length &&
    Array.isArray(l.assets) && l.assets.length <= 2000 && l.assets.every(isMediaAsset) &&
    new Set(l.assets.map(a => a.id)).size === l.assets.length && validSettings(l.settings);
}

export function nextEpisodeNumber(episodes: EpisodeData[], currentNumber = 0): number {
  return Math.max(currentNumber, ...episodes.map(ep => ep.number), 0) + 1;
}

export function upsertEpisode(episodes: EpisodeData[], episode: EpisodeData): EpisodeData[] {
  if (!isEpisode(episode)) throw new Error('Los datos del episodio no son válidos.');
  const currentIndex = episodes.findIndex(item => item.id === episode.id);
  if (currentIndex === -1) return [structuredClone(episode), ...episodes];
  return episodes.map(item => item.id === episode.id ? structuredClone(episode) : item);
}

export function upsertAsset(assets: MediaAsset[], asset: MediaAsset): MediaAsset[] {
  if (!isMediaAsset(asset)) throw new Error('Datos del archivo no válidos.');
  return assets.some(a => a.id === asset.id)
    ? assets.map(a => a.id === asset.id ? structuredClone(asset) : a)
    : [structuredClone(asset), ...assets];
}

export function makeEpisode(source: EpisodeData, number: number, title: string, cloneContent: boolean): EpisodeData {
  const base = structuredClone(source);
  return {
    ...base, id: `ep-${crypto.randomUUID()}`, number, title: title.trim(),
    date: new Date().toISOString().slice(0, 10),
    subtitle: cloneContent ? base.subtitle : '',
    description: cloneContent ? base.description : '',
    tags: cloneContent ? base.tags : [],
    phrases: cloneContent ? base.phrases : [],
    questions: cloneContent ? base.questions : [],
    quotes: cloneContent ? base.quotes : [],
    scriptures: cloneContent ? base.scriptures : [],
    tickerNews: cloneContent ? base.tickerNews : [],
    assetIds: cloneContent ? base.assetIds || [] : [],
    preparation: { ...base.preparation, manualChecks: {} },
    rundown: base.rundown.map(b => ({ ...b, id: `block-${crypto.randomUUID()}`, status: 'pending' as const })),
  };
}
