import { EpisodeData, EditorialComponentConfig, ComponentType, CountdownState, BroadcastStateSnapshot, LibraryCatalog, CustomComponentRegistry } from '../types';
import { INITIAL_EPISODE, INITIAL_COMPONENTS, INITIAL_COUNTDOWN } from '../constants/initialData';
import { SharedStation } from './sharedStation';
import {isCustomRegistry} from '../utils/componentRegistry';

const STORAGE_KEYS = {
  EPISODE: 'stdq_obs_master_episode_v3',
  COMPONENTS: 'stdq_obs_master_components_v3',
  DRAFT_COMPONENTS: 'stdq_obs_master_draft_components_v40',
  CUSTOM_COMPONENTS: 'stdq_obs_master_custom_components_v39',
  DRAFT_CUSTOM_COMPONENTS: 'stdq_obs_master_draft_custom_components_v40',
  COUNTDOWN: 'stdq_obs_master_countdown_v3',
  BACKUPS: 'stdq_obs_master_backups_v3',
  OBS_CONFIG: 'stdq_obs_master_connection_v3',
  PROTECTED_MODE: 'stdq_obs_master_protected_mode_v3',
};

export class StorageService {
  public static loadEpisode(): EpisodeData {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EPISODE);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('Could not load episode from storage, using initial data', err);
    }
    return INITIAL_EPISODE;
  }

  public static saveEpisode(episode: EpisodeData): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EPISODE, JSON.stringify(episode));
      void SharedStation.publish({ episode }).catch(err => console.error('Sincronización episodio:', err));
    } catch (err) {
      console.error('Failed to save episode to storage', err);
    }
  }

  public static loadComponents(): Record<ComponentType, EditorialComponentConfig> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPONENTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all component types exist
        const merged = { ...INITIAL_COMPONENTS, ...parsed };
        if (!parsed['logo-bug']?.branding) {
          merged['logo-bug'] = { ...merged['logo-bug'], branding: INITIAL_COMPONENTS['logo-bug'].branding };
        }
        return merged;
      }
    } catch (err) {
      console.warn('Could not load components from storage, using initial data', err);
    }
    return INITIAL_COMPONENTS;
  }

  public static saveComponents(components: Record<ComponentType, EditorialComponentConfig>, publish = true): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(components));
      if (publish) void SharedStation.publish({ components }).catch(err => console.error('Sincronización overlays:', err));
    } catch (err) {
      console.error('Failed to save components to storage', err);
    }
  }

  public static loadCustomComponents(): CustomComponentRegistry {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_COMPONENTS);
      if (raw) {
        const data: unknown = JSON.parse(raw);
        if (isCustomRegistry(data)) return data;
      }
    } catch { /* Station's persisted state remains the authoritative copy. */ }
    return {};
  }

  public static saveCustomComponents(registry: CustomComponentRegistry, publish = true): void {
    try { localStorage.setItem(STORAGE_KEYS.CUSTOM_COMPONENTS, JSON.stringify(registry)); }
    catch (err) { console.warn('No se pudo mantener la copia local de gráficas personalizadas; se prioriza el servidor.',err); }
    if (publish) void SharedStation.publish({customComponents:registry}).catch(err => console.error('Sincronización gráficas propias:',err));
  }

  public static loadDraftComponents(): Record<ComponentType, EditorialComponentConfig> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_COMPONENTS);
      if (saved) return { ...INITIAL_COMPONENTS, ...JSON.parse(saved) };
    } catch { /* Keep published content as migration baseline */ }
    return this.loadComponents();
  }
  public static saveDraftComponents(components: Record<ComponentType, EditorialComponentConfig>): void {
    try { localStorage.setItem(STORAGE_KEYS.DRAFT_COMPONENTS, JSON.stringify(components)); }
    catch (error) { console.warn('No se pudo conservar una copia local del borrador', error); }
  }
  public static loadDraftCustomComponents(): CustomComponentRegistry {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_CUSTOM_COMPONENTS);
      if (saved) { const parsed: unknown = JSON.parse(saved); if (isCustomRegistry(parsed)) return parsed; }
    } catch { /* Use published data for first migration */ }
    return this.loadCustomComponents();
  }
  public static saveDraftCustomComponents(registry: CustomComponentRegistry): void {
    try { localStorage.setItem(STORAGE_KEYS.DRAFT_CUSTOM_COMPONENTS, JSON.stringify(registry)); }
    catch (error) { console.warn('No se pudo conservar una copia local del registro borrador', error); }
  }

  public static saveSingleComponent(config: EditorialComponentConfig): Record<ComponentType, EditorialComponentConfig> {
    const current = this.loadComponents();
    const updated = {
      ...current,
      [config.type]: {
        ...config,
        updatedAt: new Date().toISOString(),
      }
    };
    this.saveDraftComponents(updated);
    void SharedStation.publish({draftComponents:updated}).catch(err=>console.error('No se pudo guardar borrador',err));
    return updated;
  }

  public static loadCountdown(): CountdownState {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COUNTDOWN);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.warn('Could not load countdown state, using initial', err);
    }
    return INITIAL_COUNTDOWN;
  }

  public static saveCountdown(state: CountdownState): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COUNTDOWN, JSON.stringify(state));
      void SharedStation.publish({ countdown: state }).catch(err => console.error('Sincronización cuenta regresiva:', err));
    } catch (err) {
      console.error('Failed to save countdown to storage', err);
    }
  }

  /** Restore the complete snapshot to local persistence and the shared OBS state. */
  public static restoreSnapshot(snapshot: BroadcastStateSnapshot): void {
    this.saveEpisode(snapshot.episode);
    this.saveDraftComponents(snapshot.components);
    void SharedStation.publish({draftComponents:snapshot.components}).catch(err=>console.error('No se pudo recuperar el borrador',err));
    if (snapshot.customComponents) {
      this.saveDraftCustomComponents(snapshot.customComponents);
      void SharedStation.publish({draftCustomComponents:snapshot.customComponents}).catch(err=>console.error('No se pudo recuperar el registro borrador',err));
    }
    if (snapshot.countdown) this.saveCountdown(snapshot.countdown);
  }

  public static createBackup(episode: EpisodeData, components: Record<ComponentType, EditorialComponentConfig>, countdown: CountdownState, library?: LibraryCatalog, customComponents:CustomComponentRegistry = this.loadCustomComponents()): BroadcastStateSnapshot {
    const snapshot: BroadcastStateSnapshot = {
      timestamp: new Date().toISOString(),
      episode: structuredClone(episode),
      components: structuredClone(components),
      customComponents:structuredClone(customComponents),
      countdown: structuredClone(countdown),
      ...(library ? { library: structuredClone(library) } : {}),
    };

    // Backups must never be reported as successful if browser storage rejected them.
    const backupsRaw = localStorage.getItem(STORAGE_KEYS.BACKUPS);
    const existing = backupsRaw ? JSON.parse(backupsRaw) as BroadcastStateSnapshot[] : [];
    const backups = [snapshot, ...existing].slice(0, 20);
    let stored = false;
    while (backups.length > 0 && !stored) {
      try {
        localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(backups));
        stored = true;
      } catch {
        if (backups.length === 1) break;
        backups.pop();
      }
    }
    if (!stored) throw new Error('El navegador no tiene espacio para guardar el respaldo. Exporta el JSON a disco.');

    return snapshot;
  }

  public static getBackups(): BroadcastStateSnapshot[] {
    try {
      const backupsRaw = localStorage.getItem(STORAGE_KEYS.BACKUPS);
      return backupsRaw ? JSON.parse(backupsRaw) : [];
    } catch {
      return [];
    }
  }

  public static deleteBackup(timestamp: string): void {
    const kept = this.getBackups().filter(backup => backup.timestamp !== timestamp);
    localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(kept));
  }

  public static exportFullStationJSON(): string {
    const data: BroadcastStateSnapshot = {
      timestamp: new Date().toISOString(),
      episode: this.loadEpisode(),
      components: this.loadComponents(),
      countdown: this.loadCountdown(),
    };
    return JSON.stringify(data, null, 2);
  }

  public static importStationJSON(jsonStr: string): BroadcastStateSnapshot | null {
    try {
      const parsed = JSON.parse(jsonStr) as BroadcastStateSnapshot;
      if (parsed.episode && parsed.components) {
        this.saveEpisode(parsed.episode);
        this.saveDraftComponents(parsed.components);
        void SharedStation.publish({draftComponents:parsed.components}).catch(err=>console.error('Error al importar borrador:',err));
        if (parsed.countdown) {
          this.saveCountdown(parsed.countdown);
        }
        this.createBackup(parsed.episode, parsed.components, parsed.countdown || INITIAL_COUNTDOWN);
        return parsed;
      }
    } catch (err) {
      console.error('Invalid JSON structure on import', err);
    }
    return null;
  }
}
