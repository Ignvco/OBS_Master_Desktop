import type { EpisodeData, LibraryCatalog, LibrarySettings, MediaAsset } from '../types';

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error ${response.status} del servicio local`);
  return payload as T;
}

export class LibraryService {
  static async read(): Promise<LibraryCatalog> {
    return (await parseResponse<{ library: LibraryCatalog }>(await fetch('/api/station/library', { cache: 'no-store' }))).library;
  }

  static async action(action: Record<string, unknown>): Promise<LibraryCatalog> {
    return (await parseResponse<{ library: LibraryCatalog }>(await fetch('/api/station/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action),
    }))).library;
  }

  static saveEpisode(episode: EpisodeData): Promise<LibraryCatalog> {
    return this.action({ action: 'episode.save', episode });
  }
  static deleteEpisode(id: string): Promise<LibraryCatalog> {
    return this.action({ action: 'episode.delete', id });
  }
  static saveAsset(asset: MediaAsset): Promise<LibraryCatalog> {
    return this.action({ action: 'asset.save', asset });
  }
  static saveSettings(settings: LibrarySettings): Promise<LibraryCatalog> {
    return this.action({ action: 'settings.save', settings });
  }
  static replace(library: LibraryCatalog): Promise<LibraryCatalog> {
    return this.action({ action: 'library.replace', library });
  }
  static async upload(file: File): Promise<{ asset: MediaAsset, library: LibraryCatalog }> {
    return parseResponse(await fetch('/api/station/media', {
      method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
    }));
  }
  static async deleteAsset(id: string): Promise<LibraryCatalog> {
    return (await parseResponse<{ library: LibraryCatalog }>(await fetch('/api/station/media-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }))).library;
  }
}
