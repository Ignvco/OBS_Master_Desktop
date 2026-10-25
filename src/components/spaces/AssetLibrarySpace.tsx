import React, { useEffect, useRef, useState } from 'react';
import {
  Archive, ArrowDownToLine, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clapperboard, Copy, Download, FileImage, FolderOpen,
  HardDrive, ImagePlus, LayoutGrid, List, LoaderCircle, Pencil,
  Plus, RefreshCw, RotateCcw, Save, Search, Settings2, ShieldCheck,
  Trash2, Upload, X,
} from 'lucide-react';
import type {
  BroadcastStateSnapshot, ComponentType, CountdownState, EditorialComponentConfig,
  EpisodeData, LibraryCatalog, LibrarySettings, MediaAsset, CustomComponentRegistry,
} from '../../types';
import { LibraryService } from '../../services/libraryService';
import { StorageService } from '../../services/storage';
import { emptyLibrary, isEpisode, isLibrary, makeEpisode, nextEpisodeNumber } from '../../utils/libraryCatalog';
import {isCustomRegistry} from '../../utils/componentRegistry';

interface Props {
  episode: EpisodeData;
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents:CustomComponentRegistry;
  countdown: CountdownState;
  onUpdateEpisode: (episode: EpisodeData) => void;
  onUpdateComponent: (component: EditorialComponentConfig) => void;
  onRestoreSnapshot: (snapshot: BroadcastStateSnapshot) => void;
  onShowToast: (type: 'success'|'warning'|'error'|'info', title: string, message?: string) => void;
}

const panel = 'atem-module';
const field = 'w-full min-w-0 rounded border border-[#2C313C] bg-[#0B0D10] px-3 py-2 text-xs text-white outline-none focus:border-[#E58A1F]';
const subtleButton = 'atem-btn inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#E6E9EF] disabled:opacity-40';
const primaryButton = 'atem-btn atem-btn-amber inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold text-[#FFC078] disabled:opacity-40';
const textButton = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8E95A3] hover:text-white';
const formatSize = (bytes?: number) => bytes === undefined ? '—' : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
const dateLabel = (date: string) => { const n = new Date(date); return Number.isNaN(n.valueOf()) ? date : n.toLocaleDateString('es-CL'); };

function downloadJSON(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const AssetLibrarySpace: React.FC<Props> = ({
  episode, components, customComponents, countdown, onUpdateEpisode, onUpdateComponent, onRestoreSnapshot, onShowToast,
}) => {
  const [library, setLibrary] = useState<LibraryCatalog>(emptyLibrary);
  const [tab, setTab] = useState<'episodes'|'assets'|'backups'>('episodes');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all'|'image'|'video'|'audio'>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<EpisodeData | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [assetEditor, setAssetEditor] = useState<MediaAsset | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backups, setBackups] = useState(() => StorageService.getBackups());
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    void (async () => {
      try {
        let result = await LibraryService.read();
        // Migration from the one-episode app: do not overwrite any previously saved episode.
        if (!result.episodes.some(e => e.id === episode.id)) result = await LibraryService.saveEpisode(episode);
        if (!isMounted.current) return;
        setLibrary(result); setTab(result.settings.startTab); setSelectedId(episode.id);
      } catch (err: any) {
        onShowToast('error', 'Biblioteca no disponible', `${err.message}. Inicia Windows mediante Vite para usar el catálogo local.`);
      } finally { if (isMounted.current) setIsLoading(false); }
    })();
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!selectedId || !library.episodes.length) return;
    const found = library.episodes.find(e => e.id === selectedId);
    if (found) setDraft(structuredClone(found));
  }, [selectedId, library.episodes]);

  async function act<T>(action: () => Promise<T>, success: string, apply?: (result: T) => void): Promise<T | undefined> {
    if (busy) return;
    setBusy(true);
    try {
      const value = await action();
      if (isMounted.current) { apply?.(value); onShowToast('success', success); }
      return value;
    } catch (err: any) {
      onShowToast('error', 'Operación no completada', err.message || 'Comprueba el servidor local.');
    } finally { if (isMounted.current) setBusy(false); }
  }

  function confirmDestructive(message: string): boolean {
    return !library.settings.confirmDeletion || window.confirm(message);
  }

  function selectTab(next: typeof tab) { setTab(next); setSearch(''); }

  async function createEpisode(clone = false) {
    const origin = clone ? (draft || episode) : episode;
    const title = clone ? `${origin.title} — copia` : newTitle.trim();
    if (!title) { onShowToast('warning', 'Introduce un título para el episodio'); return; }
    const next = makeEpisode(origin, nextEpisodeNumber(library.episodes, episode.number), title, clone);
    if (!clone) next.subtitle = newSubtitle.trim();
    const result = await act(() => LibraryService.saveEpisode(next), clone ? 'Episodio duplicado' : 'Episodio creado', setLibrary);
    if (result) {
      if (library.settings.backupBeforeSwitch) { try { StorageService.createBackup(episode, components, countdown, library); } catch (err: any) { onShowToast('warning', 'No se pudo respaldar el episodio anterior', err.message); } }
      onUpdateEpisode(next); setSelectedId(next.id); setNewTitle(''); setNewSubtitle('');
      setBackups(StorageService.getBackups());
    }
  }

  async function activateEpisode(record: EpisodeData) {
    if (record.id === episode.id) return;
    // Current episode is saved by App whenever preparation or its details change.
    if (library.settings.backupBeforeSwitch) {
      try { StorageService.createBackup(episode, components, countdown, library); setBackups(StorageService.getBackups()); }
      catch (err: any) { onShowToast('error', 'No se pudo crear el respaldo de seguridad', err.message); return; }
    }
    onUpdateEpisode(record); setSelectedId(record.id);
    onShowToast('success', `Episodio activo: ${record.title}`, 'Su escaleta y textos editoriales están cargados.');
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.title.trim()) { onShowToast('warning', 'El título no puede estar vacío'); return; }
    const updated = { ...draft, title: draft.title.trim() };
    const result = await act(() => LibraryService.saveEpisode(updated), 'Datos del episodio guardados', setLibrary);
    if (result && updated.id === episode.id) onUpdateEpisode(updated);
  }

  async function removeEpisode(record: EpisodeData) {
    if (record.id === episode.id) { onShowToast('warning', 'No puedes eliminar el episodio activo', 'Activa otro primero.'); return; }
    if (!confirmDestructive(`¿Eliminar definitivamente el episodio «${record.title}» del catálogo?`)) return;
    const result = await act(() => LibraryService.deleteEpisode(record.id), 'Episodio eliminado', setLibrary);
    if (result) setSelectedId(episode.id);
  }

  async function updateSettings(settings: LibrarySettings) {
    await act(() => LibraryService.saveSettings(settings), 'Preferencias guardadas', setLibrary);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    let completed = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 150 * 1024 * 1024) throw new Error(`${file.name}: máximo 150 MB por archivo`);
        const result = await LibraryService.upload(file);
        setLibrary(result.library); completed++;
      }
      onShowToast('success', `${completed} recurso(s) incorporados`, 'Guardados en .stdq-runtime/media.');
    } catch (err: any) { onShowToast('error', 'Error al importar recurso', `${err.message}. Se guardaron ${completed} archivos.`); }
    finally { if (isMounted.current) { setBusy(false); if (fileRef.current) fileRef.current.value = ''; } }
  }

  async function saveAssetEditor() {
    if (!assetEditor) return;
    if (!assetEditor.name.trim()) return onShowToast('warning', 'El recurso necesita un nombre');
    const updated = { ...assetEditor, name: assetEditor.name.trim() };
    const result = await act(() => LibraryService.saveAsset(updated), 'Recurso actualizado', setLibrary);
    if (result) setAssetEditor(null);
  }

  async function removeAsset(asset: MediaAsset) {
    if (components['logo-bug'].branding?.assetUrl === asset.url || Object.values(customComponents).some(g=>g.branding?.assetUrl===asset.url || g.glyph?.assetUrl===asset.url || g.layers?.some(l=>l.assetUrl===asset.url))) {
      onShowToast('warning', 'Este recurso es el logo del programa', 'Cambia primero la mosca para no dejar una imagen faltante en OBS.');
      return;
    }
    if (!confirmDestructive(`¿Eliminar «${asset.name}» de Biblioteca? Los archivos importados también se eliminarán del disco.`)) return;
    await act(() => LibraryService.deleteAsset(asset.id), 'Recurso eliminado', setLibrary);
  }

  async function toggleEpisodeAsset(asset: MediaAsset) {
    const ids = episode.assetIds || [];
    const updated = { ...episode, assetIds: ids.includes(asset.id) ? ids.filter(id => id !== asset.id) : [...ids, asset.id] };
    const result = await act(() => LibraryService.saveEpisode(updated), 'Asignaciones del capítulo actualizadas', setLibrary);
    if (result) onUpdateEpisode(updated);
  }

  function useAsLogo(asset: MediaAsset) {
    if (asset.type !== 'image' || asset.isMissing) return;
    const cfg = components['logo-bug'];
    onUpdateComponent({ ...cfg, branding: { ...(cfg.branding || { visible:true, width:120, x:18, y:5, rotation:0, opacity:1 }), assetUrl: asset.url }, updatedAt: new Date().toISOString() });
    onShowToast('info', 'Imagen aplicada a la mosca', 'Se está sincronizando con la fuente de OBS.');
  }

  function exportStation() {
    downloadJSON(`STDQ_estacion_biblioteca_${new Date().toISOString().slice(0,10)}.json`, {
      version: 3, timestamp: new Date().toISOString(), episode, components, customComponents, countdown, library,
    });
    onShowToast('info', 'Respaldo JSON descargado', 'Incluye catálogo y diseños; no incluye los archivos multimedia físicos.');
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('JSON demasiado grande (máx. 10 MB).');
      const parsed = JSON.parse(await file.text());
      if (!isEpisode(parsed.episode) || !parsed.components || typeof parsed.components !== 'object' || !parsed.countdown || typeof parsed.countdown.remainingSeconds !== 'number') throw new Error('El archivo no es un respaldo de estación válido.');
      if (parsed.library && !isLibrary(parsed.library)) throw new Error('El catálogo incluido no es válido.');
      if (parsed.customComponents !== undefined && !isCustomRegistry(parsed.customComponents)) throw new Error('El registro de gráficas personalizadas no es válido.');
      if (!window.confirm('¿Restaurar la estación y reemplazar la configuración actual? Se creará primero un respaldo local.')) return;
      StorageService.createBackup(episode, components, countdown, library);
      if (parsed.library) {
        const result = await LibraryService.replace(parsed.library);
        setLibrary(result);
      }
      const snapshot: BroadcastStateSnapshot = { timestamp: parsed.timestamp || new Date().toISOString(), episode: parsed.episode,
        components: parsed.components, customComponents:parsed.customComponents, countdown: parsed.countdown, library: parsed.library };
      onRestoreSnapshot(snapshot);
      await LibraryService.saveEpisode(snapshot.episode);
      setBackups(StorageService.getBackups()); setSelectedId(snapshot.episode.id);
      onShowToast('success', 'Respaldo restaurado', 'Comprueba los medios vinculados: el JSON no contiene archivos binarios.');
    } catch (err: any) { onShowToast('error', 'No se pudo importar', err.message); }
    finally { if (importRef.current) importRef.current.value = ''; }
  }

  async function restoreBackup(snapshot: BroadcastStateSnapshot) {
    if (!window.confirm(`¿Restaurar la estación guardada el ${new Date(snapshot.timestamp).toLocaleString('es-CL')}?`)) return;
    StorageService.createBackup(episode, components, countdown, library);
    if (snapshot.library) {
      const result = await act(() => LibraryService.replace(snapshot.library!), 'Catálogo recuperado', setLibrary);
      if (!result) return;
    }
    onRestoreSnapshot(snapshot); setSelectedId(snapshot.episode.id);
    setBackups(StorageService.getBackups());
    onShowToast('success', 'Estación restaurada', 'Se restauraron episodio, gráficas y temporizador.');
  }

  function createBackup() {
    try { StorageService.createBackup(episode, components, countdown, library); setBackups(StorageService.getBackups()); onShowToast('success', 'Punto de restauración creado', 'El catálogo y los ajustes quedaron guardados en este navegador.'); }
    catch (err: any) { onShowToast('error', 'No se pudo crear el respaldo', err.message); }
  }

  const filteredEpisodes = library.episodes.filter(e => `${e.title} ${e.subtitle} ${e.number} ${(e.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const filteredAssets = library.assets.filter(a => (typeFilter === 'all' || a.type === typeFilter) && `${a.name} ${a.type} ${(a.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const missingAssets = library.assets.filter(a => a.isMissing).length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0D0F13] px-4 py-4 lg:px-6 lg:py-5">
      <div className="mx-auto w-full max-w-[1680px] space-y-4 pb-10">
        {/* ATEM Media Pool Top Header */}
        <div className="atem-module overflow-hidden">
          <div className="atem-module-header">
            <span className="atem-label text-[#E6E9EF]">MEDIA POOL &amp; ARCHIVE · ESPACIO 5 (BIBLIOTECA)</span>
            <span className="font-mono text-[10px] font-bold text-[#8E95A3]">.stdq-runtime/media</span>
          </div>
          <div className="p-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#0A0B0E] border border-[#2C313C] font-mono text-[10px] font-bold text-[#00A8E8]">
                  EP ACTIVO #{episode.number}
                </span>
                <h1 className="text-base font-black tracking-tight text-white">Biblioteca &amp; Media Pool</h1>
              </div>
              <p className="mt-1 text-[11px] text-[#8E95A3]">
                Capítulos recuperables, slots multimedia numerados, puntos de restauración y preferencias de catálogo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={subtleButton} onClick={async () => { setIsLoading(true); try { setLibrary(await LibraryService.read()); onShowToast('info', 'Biblioteca actualizada'); } catch (e:any) { onShowToast('error','No se pudo actualizar',e.message); } finally { setIsLoading(false); } }}><RefreshCw size={13}/> Actualizar</button>
              <button className={subtleButton} onClick={() => setShowSettings(true)}><Settings2 size={13}/> Preferencias</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-[#2C313C] border-t border-[#2C313C] lg:grid-cols-4">
            {[
              [<Clapperboard size={15}/>, String(library.episodes.length).padStart(2, '0'), 'EPISODIOS ARCHIVADOS', 'text-[#00A8E8]'],
              [<HardDrive size={15}/>, String(library.assets.length).padStart(2, '0'), 'SLOTS EN MEDIA POOL', 'text-[#00C853]'],
              [<CircleAlert size={15}/>, String(missingAssets).padStart(2, '0'), 'ARCHIVOS FALTANTES', missingAssets > 0 ? 'text-[#E58A1F]' : 'text-[#58606E]'],
              [<ShieldCheck size={15}/>, String(backups.length).padStart(2, '0'), 'SNAPSHOTS LOCALES', 'text-[#E58A1F]'],
            ].map(([icon, value, label, colorClass], i) => (
              <div key={i} className="bg-[#13161B] flex items-center gap-3 px-3.5 py-2.5">
                <div className={`rounded border border-[#2C313C] bg-[#0B0D10] p-2 ${colorClass}`}>{icon}</div>
                <div>
                  <div className={`font-mono text-base font-black tabular-nums ${colorClass}`}>{value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E95A3]">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-bank Navigation & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 atem-well p-2">
          <div className="flex items-center gap-1">
            {([['episodes','EPISODIOS ARCHIVADOS'],['assets','MEDIA POOL (RECURSOS)'],['backups','SNAPSHOTS & RESPALDO']] as const).map(([key, label]) =>
              <button key={key} onClick={() => void selectTab(key)} className={`atem-btn px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tab === key ? 'atem-btn-amber text-[#FFC078]' : 'text-[#8E95A3] hover:text-white'}`}>{label}</button>
            )}
          </div>
          {tab !== 'backups' && <div className="flex w-full items-center gap-2 rounded border border-[#2C313C] bg-[#0B0D10] px-2.5 sm:w-80"><Search size={13} className="text-[#8E95A3]"/><input aria-label="Buscar en Biblioteca" placeholder="Buscar por nombre, etiqueta o número…" className="w-full bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-[#58606E]" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button onClick={()=>setSearch('')} title="Limpiar búsqueda" className="text-[#8E95A3] hover:text-white"><X size={13}/></button>}</div>}
        </div>

        {isLoading && <div className={`${panel} flex items-center gap-3 p-5 text-xs font-mono text-[#8E95A3]`}><LoaderCircle className="animate-spin text-[#E58A1F]" size={16}/> CARGANDO CATÁLOGO LOCAL…</div>}

        {!isLoading && tab === 'episodes' && <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
          <section className={`${panel} overflow-hidden`}>
            <div className="atem-module-header">
              <span className="atem-label text-[#E6E9EF]">CATÁLOGO DE EPISODIOS</span>
              <span className="font-mono text-[10px] font-bold text-[#8E95A3]">{filteredEpisodes.length} REGISTROS</span>
            </div>
            <div className="max-h-[620px] divide-y divide-[#252932] overflow-y-auto">
              {filteredEpisodes.length === 0 && <div className="p-8 text-center text-xs text-[#8E95A3]">Aún no hay capítulos que coincidan con tu búsqueda.</div>}
              {filteredEpisodes.map(ep => <button key={ep.id} onClick={() => setSelectedId(ep.id)} className={`flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-[#1B1F27] ${selectedId === ep.id ? 'bg-[#E58A1F]/10 border-l-2 border-l-[#E58A1F]' : ''}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border font-mono text-xs font-black ${ep.id === episode.id ? 'bg-[#00C853]/15 border-[#00C853]/50 text-[#69F0AE]' : 'bg-[#0B0D10] border-[#2C313C] text-[#8E95A3]'}`}>#{ep.number}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white">{ep.title}</div>
                  <div className="truncate font-mono text-[10px] text-[#8E95A3]">{ep.subtitle || 'Sin subtítulo'} · T{ep.season} · {dateLabel(ep.date)}</div>
                </div>
                {ep.id === episode.id && <span className="rounded bg-[#00C853]/15 border border-[#00C853]/40 px-2 py-0.5 font-mono text-[9px] font-bold text-[#69F0AE]">ACTIVO</span>}
                <ChevronRight size={14} className="text-[#58606E]"/>
              </button>)}
            </div>
          </section>
          <div className="space-y-4">
            <section className={`${panel} overflow-hidden`}>
              <div className="atem-module-header">
                <span className="atem-label text-[#E6E9EF]">NUEVO EPISODIO</span>
                <span className="font-mono text-[10px] text-[#8E95A3]">CLONA ESCALETA BASE</span>
              </div>
              <div className="p-4 space-y-3">
                <input aria-label="Título del nuevo episodio" className={field} placeholder="Título del nuevo capítulo" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/>
                <input aria-label="Subtítulo del nuevo episodio" className={field} placeholder="Subtítulo (opcional)" value={newSubtitle} onChange={e=>setNewSubtitle(e.target.value)}/>
                <button disabled={!newTitle.trim() || busy} className={`${primaryButton} w-full py-2`} onClick={() => void createEpisode(false)}><Plus size={14}/> Crear y activar episodio #{nextEpisodeNumber(library.episodes, episode.number)}</button>
              </div>
            </section>
            {draft && <section className={`${panel} overflow-hidden`}>
              <div className="atem-module-header">
                <span className="atem-label text-[#E6E9EF]">DETALLES DEL EPISODIO #{draft.number}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold text-[#8E95A3]">{draft.id === episode.id ? 'EN ESTACIÓN' : 'ARCHIVADO'}</span>
                  <button className="atem-btn px-2 py-0.5 text-[10px] font-bold text-[#E6E9EF] inline-flex items-center gap-1" onClick={()=>downloadJSON(`STDQ_episodio_${draft.number}.json`,draft)}><Download size={11}/> JSON</button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Título<input className={field} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Subtítulo<input className={field} value={draft.subtitle} onChange={e=>setDraft({...draft,subtitle:e.target.value})}/></label>
                <div className="grid grid-cols-2 gap-3"><label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Temporada<input className={field} type="number" min="1" value={draft.season} onChange={e=>setDraft({...draft,season:Math.max(1,Number(e.target.value)||1)})}/></label><label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Fecha<input className={field} type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.date)?draft.date:''} onChange={e=>setDraft({...draft,date:e.target.value})}/></label></div>
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Descripción<textarea className={field} rows={2} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Etiquetas (separadas por coma)<input className={field} value={(draft.tags||[]).join(', ')} onChange={e=>setDraft({...draft,tags:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}/></label>
                <div className="space-y-2 border-t border-[#252932] pt-3"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-[#E6E9EF]">Conductores e invitados</span><button className={subtleButton} onClick={()=>setDraft({...draft,hosts:[...draft.hosts,{id:crypto.randomUUID(),name:'',role:'Conductor'}]})}><Plus size={11}/> Agregar</button></div>{draft.hosts.map(host=><div key={host.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input className={field} aria-label="Nombre del conductor" placeholder="Nombre" value={host.name} onChange={e=>setDraft({...draft,hosts:draft.hosts.map(h=>h.id===host.id?{...h,name:e.target.value}:h)})}/><input className={field} aria-label="Rol del conductor" placeholder="Rol" value={host.role} onChange={e=>setDraft({...draft,hosts:draft.hosts.map(h=>h.id===host.id?{...h,role:e.target.value}:h)})}/><button aria-label="Eliminar conductor" className="px-2 text-[#D91F26] hover:text-rose-300" onClick={()=>setDraft({...draft,hosts:draft.hosts.filter(h=>h.id!==host.id)})}><Trash2 size={14}/></button></div>)}</div>
                <div className="grid grid-cols-2 gap-2 pt-1"><button className={primaryButton} disabled={busy || !draft.title.trim()} onClick={()=>void saveDraft()}><Save size={13}/> Guardar cambios</button><button className={subtleButton} disabled={busy || draft.id === episode.id} onClick={()=>void activateEpisode(library.episodes.find(e => e.id === draft.id) || draft)}><Check size={13}/> Activar episodio</button></div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-[#252932] pt-3"><button className={textButton} onClick={()=>void createEpisode(true)}><Copy size={13}/> Duplicar episodio seleccionado</button><button disabled={draft.id === episode.id || busy} onClick={()=>void removeEpisode(draft)} className="flex items-center gap-1 text-[11px] font-bold text-[#D91F26] disabled:opacity-30"><Trash2 size={12}/> Eliminar</button></div>
                <p className="text-[10px] text-[#58606E]">La escaleta y contenidos del episodio activo se editan desde Preparación. Cambiar el episodio no cambia automáticamente las escenas de OBS.</p>
              </div>
            </section>}
          </div>
        </div>}

        {!isLoading && tab === 'assets' && <div className="space-y-4">
          <section className={`${panel} p-3.5 flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">ATEM Media Pool · Recursos de Producción</h2>
              <p className="mt-0.5 text-[11px] text-[#8E95A3]">Sube imágenes, videos y audio a la biblioteca local. Máximo 150 MB por archivo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><select aria-label="Filtrar recursos por tipo" className="rounded border border-[#2C313C] bg-[#0B0D10] px-2.5 py-1.5 text-[11px] font-bold text-white outline-none focus:border-[#E58A1F]" value={typeFilter} onChange={e=>setTypeFilter(e.target.value as typeof typeFilter)}><option value="all">Todos los tipos</option><option value="image">Imágenes (Stills)</option><option value="video">Videos (Clips)</option><option value="audio">Audio</option></select><button className={subtleButton} title="Vista cuadrícula" onClick={()=>void updateSettings({...library.settings,assetView:'grid'})}><LayoutGrid size={14}/></button><button className={subtleButton} title="Vista lista" onClick={()=>void updateSettings({...library.settings,assetView:'list'})}><List size={14}/></button><button className={primaryButton} disabled={busy} onClick={()=>fileRef.current?.click()}><Upload size={13}/> Importar recursos</button></div>
            <input ref={fileRef} className="hidden" multiple type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/x-wav" onChange={e=>void uploadFiles(e.target.files)}/>
          </section>
          {missingAssets > 0 && <div className="flex gap-2 rounded border border-[#E58A1F]/40 bg-[#E58A1F]/10 p-3 text-xs text-[#FFC078]"><CircleAlert size={15}/> {missingAssets} recurso(s) sin archivo físico. Si importaste un JSON en otro equipo, vuelve a cargar los medios correspondientes.</div>}
          {filteredAssets.length === 0 && <div className={`${panel} p-10 text-center`}><FolderOpen size={28} className="mx-auto mb-2 text-[#58606E]"/><p className="text-xs font-bold text-white">No hay recursos disponibles en el Media Pool</p><p className="mt-1 text-[11px] text-[#8E95A3]">Importa tu primer archivo o cambia la búsqueda.</p></div>}
          <div className={library.settings.assetView==='grid'?'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4':'space-y-2.5'}>
            {filteredAssets.map((asset, idx) => <article key={asset.id} className={`${panel} overflow-hidden ${library.settings.assetView==='list'?'flex flex-wrap items-center gap-4 p-3':'flex flex-col'}`}>
              <div
                className={`relative flex shrink-0 items-center justify-center overflow-hidden border-b border-[#252932] ${library.settings.assetView==='grid'?'aspect-video w-full':'h-20 w-36 rounded border'}`}
                style={{ background: 'repeating-conic-gradient(#12141a 0% 25%, #0a0b0e 0% 50%) 50% / 14px 14px' }}
              >
                <span className="absolute left-2 top-2 z-10 rounded bg-black/80 border border-[#2C313C] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#8E95A3]">
                  SLOT {String(idx + 1).padStart(2, '0')}
                </span>
                {asset.isMissing ? <CircleAlert size={24} className="text-[#E58A1F]"/> : asset.type === 'image' ? <img src={asset.url} alt={asset.name} className="h-full w-full object-contain"/> : asset.type === 'video' ? <video src={asset.url} className="h-full w-full object-contain" muted preload="metadata" controls/> : asset.type === 'audio' ? <div className="flex flex-col items-center gap-2"><Clapperboard size={18} className="text-[#E58A1F]"/><audio src={asset.url} controls preload="none" className="h-8 max-w-[220px]"/></div> : <FileImage size={22} className="text-[#8E95A3]"/>}
              </div>
              <div className={`min-w-0 flex-1 space-y-2 ${library.settings.assetView==='grid'?'p-3':''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 title={asset.name} className="truncate text-xs font-bold text-white">{asset.name}</h3>
                    <p className="mt-0.5 font-mono text-[10px] text-[#8E95A3]">{asset.type.toUpperCase()} · {formatSize(asset.sizeBytes)} · {dateLabel(asset.uploadedAt)}</p>
                  </div>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${asset.isMissing?'border-[#E58A1F]/40 bg-[#E58A1F]/10 text-[#FFC078]':'border-[#00C853]/40 bg-[#00C853]/10 text-[#69F0AE]'}`}>{asset.isMissing?'SIN ARCHIVO':'DISPONIBLE'}</span>
                </div>
                <div className="flex flex-wrap gap-1">{(asset.tags || []).slice(0,4).map(t=><span key={t} className="rounded bg-[#0B0D10] border border-[#2C313C] px-1.5 py-0.5 font-mono text-[9px] text-[#8E95A3]">{t}</span>)}</div>
                <div className="flex flex-wrap gap-1.5 pt-1"><button className={subtleButton} onClick={()=>setAssetEditor({...asset})}><Pencil size={11}/> Editar</button><button className={subtleButton} disabled={asset.isMissing} onClick={()=>{void navigator.clipboard.writeText(`${window.location.origin}${asset.url}`).then(()=>onShowToast('success','Enlace copiado')).catch(()=>onShowToast('warning','No se pudo copiar el enlace'));}}><Copy size={11}/> URL</button><a className={subtleButton} href={asset.isMissing?undefined:asset.url} download={asset.name} onClick={e=>{if(asset.isMissing)e.preventDefault();}}><Download size={11}/></a>
                  {asset.type === 'image' && <button className={subtleButton} disabled={asset.isMissing} title="Aplicar como logo del programa" onClick={()=>useAsLogo(asset)}><ImagePlus size={11}/> Mosca</button>}
                  <button className={subtleButton} title="Vincular o desvincular del episodio activo" onClick={()=>void toggleEpisodeAsset(asset)}>{(episode.assetIds||[]).includes(asset.id)?<CheckCircle2 size={11} className="text-[#00C853]"/>:<Plus size={11}/>} Episodio</button>
                  <button disabled={busy} onClick={()=>void removeAsset(asset)} title="Eliminar de biblioteca" className="atem-btn px-2 py-1 text-[#D91F26] hover:bg-[#D91F26]/10"><Trash2 size={12}/></button>
                </div>
              </div>
            </article>)}
          </div>
          <p className="font-mono text-[10px] text-[#8E95A3]">Los archivos subidos se guardan en <code>.stdq-runtime/media</code>. El enlace sirve para Browser Sources y elementos HTML; un archivo local de OBS Media Source se configura por separado. La carga no inicia reproducción ni transmisión automáticamente.</p>
        </div>}

        {!isLoading && tab === 'backups' && <div className="space-y-4">
          <section className={`${panel} flex flex-wrap items-center justify-between gap-4 p-4`}><div><h2 className="text-xs font-bold uppercase tracking-wider text-white">Respaldo y recuperación de estación</h2><p className="mt-0.5 text-[11px] text-[#8E95A3]">Los puntos locales guardan el estado actual. El JSON incluye catálogo y configuración, pero no los videos e imágenes físicos.</p></div><div className="flex flex-wrap gap-2"><button className={primaryButton} onClick={createBackup}><Plus size={13}/> Crear respaldo</button><button className={subtleButton} onClick={exportStation}><ArrowDownToLine size={13}/> Exportar estación</button><button className={subtleButton} onClick={()=>importRef.current?.click()}><Upload size={13}/> Importar JSON</button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>void importFile(e.target.files?.[0])}/></div></section>
          <section className={`${panel} overflow-hidden`}><div className="atem-module-header"><span className="atem-label text-[#E6E9EF]">PUNTOS DE RESTAURACIÓN ({backups.length})</span></div>{backups.length===0 && <p className="p-8 text-center text-xs text-[#8E95A3]">Todavía no hay respaldos en este navegador.</p>}{backups.map((b, index) => <div key={`${b.timestamp}-${index}`} className="flex flex-wrap items-center gap-3 border-b border-[#252932] p-3.5"><div className="rounded border border-[#2C313C] bg-[#0B0D10] p-2 text-[#E58A1F]"><Archive size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">#{b.episode.number} {b.episode.title}</p><p className="font-mono text-[10px] text-[#8E95A3]">{new Date(b.timestamp).toLocaleString('es-CL')} · {b.library?'CON CATÁLOGO':'SOLO ESTACIÓN'}</p></div><button className={subtleButton} onClick={()=>downloadJSON(`STDQ_snapshot_${index+1}.json`, b)}><Download size={11}/></button><button className={subtleButton} onClick={()=>void restoreBackup(b)}><RotateCcw size={11}/> Restaurar</button><button className="atem-btn px-2 py-1 text-[#D91F26] hover:bg-[#D91F26]/10" onClick={()=>{if(!confirmDestructive('¿Eliminar este punto de restauración?'))return;StorageService.deleteBackup(b.timestamp);setBackups(StorageService.getBackups());}}><Trash2 size={12}/></button></div>)}</section>
        </div>}
      </div>

      {assetEditor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editar recurso"><div className={`${panel} w-full max-w-lg overflow-hidden shadow-2xl`}><div className="atem-module-header"><span className="atem-label text-[#E6E9EF]">EDITAR RECURSO DE MEDIA POOL</span><button onClick={()=>setAssetEditor(null)} className="text-[#8E95A3] hover:text-white"><X size={16}/></button></div><div className="p-5 space-y-3.5"><label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Nombre<input className={field} value={assetEditor.name} onChange={e=>setAssetEditor({...assetEditor,name:e.target.value})}/></label><label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Etiquetas<input className={field} value={(assetEditor.tags||[]).join(', ')} onChange={e=>setAssetEditor({...assetEditor,tags:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}/></label><label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Notas<textarea className={field} rows={3} value={assetEditor.notes||''} onChange={e=>setAssetEditor({...assetEditor,notes:e.target.value})}/></label><p className="break-all font-mono text-[10px] text-[#58606E]">{assetEditor.url}</p><div className="flex justify-end gap-2 pt-2"><button className={subtleButton} onClick={()=>setAssetEditor(null)}>Cancelar</button><button className={primaryButton} disabled={busy} onClick={()=>void saveAssetEditor()}><Save size={12}/> Guardar</button></div></div></div></div>}

      {showSettings && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Preferencias de Biblioteca"><div className={`${panel} w-full max-w-lg overflow-hidden shadow-2xl`}><div className="atem-module-header"><span className="atem-label text-[#E6E9EF]">PREFERENCIAS DE BIBLIOTECA</span><button onClick={()=>setShowSettings(false)} className="text-[#8E95A3] hover:text-white"><X size={16}/></button></div><div className="p-5 space-y-4"><label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Pestaña inicial<select value={library.settings.startTab} className={field} onChange={e=>void updateSettings({...library.settings,startTab:e.target.value as LibrarySettings['startTab']})}><option value="episodes">Episodios</option><option value="assets">Recursos</option><option value="backups">Respaldos</option></select></label><label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Vista de recursos<select value={library.settings.assetView} className={field} onChange={e=>void updateSettings({...library.settings,assetView:e.target.value as LibrarySettings['assetView']})}><option value="grid">Cuadrícula</option><option value="list">Lista</option></select></label><label className="flex items-center gap-3 text-xs text-[#E6E9EF]"><input type="checkbox" checked={library.settings.confirmDeletion} onChange={e=>void updateSettings({...library.settings,confirmDeletion:e.target.checked})}/> Confirmar antes de eliminar recursos y episodios</label><label className="flex items-center gap-3 text-xs text-[#E6E9EF]"><input type="checkbox" checked={library.settings.backupBeforeSwitch} onChange={e=>void updateSettings({...library.settings,backupBeforeSwitch:e.target.checked})}/> Crear respaldo antes de activar otro episodio</label><div className="rounded border border-[#E58A1F]/30 bg-[#E58A1F]/10 p-3 text-[11px] text-[#FFC078]">Los respaldos del navegador pueden perderse al borrar los datos del sitio. Exporta el JSON y conserva por separado la carpeta .stdq-runtime/media.</div><button className={`${primaryButton} w-full py-2`} onClick={()=>setShowSettings(false)}>Cerrar preferencias</button></div></div></div>}
    </div>
  );
};
