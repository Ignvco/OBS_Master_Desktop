import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATA_DIRECTORY, STATIC_DIRECTORY } from './runtimePaths.ts';
import { emptyLibrary, isEpisode, isLibrary, isMediaAsset, upsertAsset, upsertEpisode, validSettings } from '../utils/libraryCatalog.ts';
import type { LibraryCatalog, MediaAsset } from '../types/index.ts';

const FILE = resolve(DATA_DIRECTORY, 'library.json');
const OFFICIAL_LOGO = resolve(STATIC_DIRECTORY, 'assets', 'stdq-logo-oficial.png');
let cached: LibraryCatalog | null = null;
export function resetLibraryCache() { cached = null; }

export function readLibrary(): LibraryCatalog {
  if (cached) return structuredClone(cached);
  if (existsSync(FILE)) {
    let data: unknown;
    try { data = JSON.parse(readFileSync(FILE, 'utf8')); }
    catch { throw new Error('library.json está dañado. Respáldalo antes de repararlo; no se sobrescribirá.'); }
    if (!isLibrary(data)) throw new Error('library.json tiene una estructura inválida. No se sobrescribirá automáticamente.');
    cached = data;
    return structuredClone(cached);
  }
  const initial = emptyLibrary();
  if (existsSync(OFFICIAL_LOGO)) {
    const logo: MediaAsset = {
      id: 'stdq-logo-oficial', name: 'Logo oficial STdQ', type: 'image',
      url: '/assets/stdq-logo-oficial.png', sizeBytes: statSync(OFFICIAL_LOGO).size,
      uploadedAt: '2026-10-19T00:00:00.000Z', tags: ['Marca'],
    };
    initial.assets.push(logo);
  }
  cached = initial;
  return structuredClone(initial);
}

function persist(library: LibraryCatalog) {
  if (!isLibrary(library)) throw new Error('Catálogo de biblioteca inválido.');
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(library), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, FILE);
  cached = structuredClone(library);
}

export type LibraryMutation =
  | { action: 'episode.save'; episode: unknown }
  | { action: 'episode.delete'; id: unknown }
  | { action: 'asset.save'; asset: unknown }
  | { action: 'asset.delete'; id: unknown }
  | { action: 'settings.save'; settings: unknown }
  | { action: 'library.replace'; library: unknown };

export function mutateLibrary(input: LibraryMutation): LibraryCatalog {
  const current = readLibrary();
  switch (input.action) {
    case 'episode.save':
      if (!isEpisode(input.episode)) throw new Error('Episodio inválido.');
      current.episodes = upsertEpisode(current.episodes, input.episode);
      break;
    case 'episode.delete':
      if (typeof input.id !== 'string') throw new Error('Identificador inválido.');
      current.episodes = current.episodes.filter(e => e.id !== input.id);
      break;
    case 'asset.save':
      if (!isMediaAsset(input.asset)) throw new Error('Recurso inválido.');
      current.assets = upsertAsset(current.assets, input.asset);
      break;
    case 'asset.delete':
      if (typeof input.id !== 'string') throw new Error('Identificador inválido.');
      current.assets = current.assets.filter(a => a.id !== input.id);
      current.episodes = current.episodes.map(e => ({ ...e, assetIds: (e.assetIds || []).filter(id => id !== input.id) }));
      break;
    case 'settings.save':
      if (!validSettings(input.settings)) throw new Error('Preferencias inválidas.');
      current.settings = { ...input.settings };
      break;
    case 'library.replace':
      if (!isLibrary(input.library)) throw new Error('Archivo de biblioteca inválido.');
      // Never remove physical files merely because they are absent from the imported metadata.
      persist(input.library);
      return libraryWithStatus();
    default: throw new Error('Acción desconocida.');
  }
  persist(current);
  return libraryWithStatus();
}

/** Probe the filesystem; never report availability without checking. */
export function libraryWithStatus(): LibraryCatalog {
  const result = readLibrary();
  result.assets = result.assets.map(asset => {
    const filename = asset.url.split('/').pop() || '';
    const path = asset.url.startsWith('/api/station/media/')
      ? resolve(DATA_DIRECTORY, 'media', filename)
      : asset.url === '/assets/stdq-logo-oficial.png' ? OFFICIAL_LOGO : '';
    return { ...asset, isMissing: !path || !existsSync(path) };
  });
  return result;
}
