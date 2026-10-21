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

const panel = 'rounded-2xl border border-white/10 bg-white/[0.035]';
const field = 'w-full min-w-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B00]/70';
const subtleButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.11] disabled:opacity-40';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#FF812A] disabled:opacity-40';
const textButton = 'inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white';
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
    <div className="flex-1 overflow-y-auto bg-[#090A0E] px-5 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[1560px] space-y-6 pb-12 animate-in fade-in duration-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF6B00]">Espacio E · Gestión de producción</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">Biblioteca</h1>
            <p className="mt-1 text-xs text-slate-400">Capítulos recuperables, recursos reales, seguridad y preferencias de trabajo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={subtleButton} onClick={async () => { setIsLoading(true); try { setLibrary(await LibraryService.read()); onShowToast('info', 'Biblioteca actualizada'); } catch (e:any) { onShowToast('error','No se pudo actualizar',e.message); } finally { setIsLoading(false); } }}><RefreshCw size={14}/> Actualizar</button>
            <button className={subtleButton} onClick={() => setShowSettings(true)}><Settings2 size={14}/> Preferencias</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [<Clapperboard size={18}/>, String(library.episodes.length), 'Episodios archivados'],
            [<HardDrive size={18}/>, String(library.assets.length), 'Recursos multimedia'],
            [<CircleAlert size={18}/>, String(missingAssets), 'Recursos no encontrados'],
            [<ShieldCheck size={18}/>, String(backups.length), 'Puntos de restauración'],
          ].map(([icon, value, label], i) => <div key={i} className={`${panel} flex items-center gap-3 p-3.5`}><div className="rounded-xl bg-[#FF6B00]/10 p-2 text-[#FF8534]">{icon}</div><div><div className="text-xl font-extrabold text-white">{value}</div><div className="text-[10px] text-slate-400">{label}</div></div></div>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex rounded-xl border border-white/10 bg-white/[0.035] p-1">
            {([['episodes','Episodios'],['assets','Recursos'],['backups','Respaldos']] as const).map(([key, label]) =>
              <button key={key} onClick={() => void selectTab(key)} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === key ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
            )}
          </div>
          {tab !== 'backups' && <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 sm:w-72"><Search size={14} className="text-slate-400"/><input aria-label="Buscar en Biblioteca" placeholder="Buscar por nombre, etiqueta o número…" className="w-full bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-500" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button onClick={()=>setSearch('')} title="Limpiar búsqueda"><X size={13}/></button>}</div>}
        </div>

        {isLoading && <div className={`${panel} flex items-center gap-3 p-6 text-sm text-slate-300`}><LoaderCircle className="animate-spin" size={17}/> Cargando biblioteca local…</div>}

        {!isLoading && tab === 'episodes' && <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.85fr)]">
          <section className={`${panel} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4"><div><h2 className="text-sm font-bold text-white">Catálogo de episodios</h2><p className="mt-0.5 text-[11px] text-slate-400">Selecciona un episodio para editar o activarlo.</p></div><span className="text-[10px] text-slate-500">{filteredEpisodes.length} resultados</span></div>
            <div className="max-h-[620px] divide-y divide-white/5 overflow-y-auto">
              {filteredEpisodes.length === 0 && <div className="p-10 text-center text-xs text-slate-400">Aún no hay capítulos que coincidan con tu búsqueda.</div>}
              {filteredEpisodes.map(ep => <button key={ep.id} onClick={() => setSelectedId(ep.id)} className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.055] ${selectedId === ep.id ? 'bg-[#FF6B00]/[0.08]' : ''}`}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black ${ep.id === episode.id ? 'bg-[#FF6B00] text-white' : 'bg-white/10 text-slate-300'}`}>{ep.number}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{ep.title}</div><div className="truncate text-[11px] text-slate-400">{ep.subtitle || 'Sin subtítulo'} · T{ep.season} · {dateLabel(ep.date)}</div></div>
                {ep.id === episode.id && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">ACTIVO</span>}
                <ChevronRight size={15} className="text-slate-500"/>
              </button>)}
            </div>
          </section>
          <div className="space-y-5">
            <section className={`${panel} space-y-4 p-5`}>
              <div><h2 className="text-sm font-bold text-white">Nuevo episodio</h2><p className="text-[11px] text-slate-400">Crea un capítulo reutilizando la estructura de la escaleta.</p></div>
              <input aria-label="Título del nuevo episodio" className={field} placeholder="Título del nuevo capítulo" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/>
              <input aria-label="Subtítulo del nuevo episodio" className={field} placeholder="Subtítulo (opcional)" value={newSubtitle} onChange={e=>setNewSubtitle(e.target.value)}/>
              <button disabled={!newTitle.trim() || busy} className={`${primaryButton} w-full`} onClick={() => void createEpisode(false)}><Plus size={15}/> Crear y activar episodio #{nextEpisodeNumber(library.episodes, episode.number)}</button>
            </section>
            {draft && <section className={`${panel} space-y-4 p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-white">Detalles del episodio</h2><p className="text-[11px] text-slate-400">#{draft.number} · {draft.id === episode.id ? 'En estación' : 'Archivado'}</p></div><button className={subtleButton} onClick={()=>downloadJSON(`STDQ_episodio_${draft.number}.json`,draft)}><Download size={13}/> Exportar</button></div>
              <label className="block space-y-1 text-[11px] text-slate-400">Título<input className={field} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
              <label className="block space-y-1 text-[11px] text-slate-400">Subtítulo<input className={field} value={draft.subtitle} onChange={e=>setDraft({...draft,subtitle:e.target.value})}/></label>
              <div className="grid grid-cols-2 gap-3"><label className="block space-y-1 text-[11px] text-slate-400">Temporada<input className={field} type="number" min="1" value={draft.season} onChange={e=>setDraft({...draft,season:Math.max(1,Number(e.target.value)||1)})}/></label><label className="block space-y-1 text-[11px] text-slate-400">Fecha<input className={field} type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(draft.date)?draft.date:''} onChange={e=>setDraft({...draft,date:e.target.value})}/></label></div>
              <label className="block space-y-1 text-[11px] text-slate-400">Descripción<textarea className={field} rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
              <label className="block space-y-1 text-[11px] text-slate-400">Etiquetas (separadas por coma)<input className={field} value={(draft.tags||[]).join(', ')} onChange={e=>setDraft({...draft,tags:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}/></label>
              <div className="space-y-2 border-t border-white/10 pt-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-white">Conductores e invitados</span><button className={subtleButton} onClick={()=>setDraft({...draft,hosts:[...draft.hosts,{id:crypto.randomUUID(),name:'',role:'Conductor'}]})}><Plus size={12}/> Agregar</button></div>{draft.hosts.map(host=><div key={host.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input className={field} aria-label="Nombre del conductor" placeholder="Nombre" value={host.name} onChange={e=>setDraft({...draft,hosts:draft.hosts.map(h=>h.id===host.id?{...h,name:e.target.value}:h)})}/><input className={field} aria-label="Rol del conductor" placeholder="Rol" value={host.role} onChange={e=>setDraft({...draft,hosts:draft.hosts.map(h=>h.id===host.id?{...h,role:e.target.value}:h)})}/><button aria-label="Eliminar conductor" className="px-2 text-red-400 hover:text-red-300" onClick={()=>setDraft({...draft,hosts:draft.hosts.filter(h=>h.id!==host.id)})}><Trash2 size={15}/></button></div>)}</div>
              <div className="grid grid-cols-2 gap-2"><button className={primaryButton} disabled={busy || !draft.title.trim()} onClick={()=>void saveDraft()}><Save size={14}/> Guardar cambios</button><button className={subtleButton} disabled={busy || draft.id === episode.id} onClick={()=>void activateEpisode(library.episodes.find(e => e.id === draft.id) || draft)}><Check size={14}/> Activar episodio</button></div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3"><button className={textButton} onClick={()=>void createEpisode(true)}><Copy size={14}/> Duplicar episodio seleccionado</button><button disabled={draft.id === episode.id || busy} onClick={()=>void removeEpisode(draft)} className="flex items-center gap-1 text-xs font-semibold text-red-400 disabled:opacity-30"><Trash2 size={13}/> Eliminar</button></div>
              <p className="text-[10px] text-slate-500">La escaleta y contenidos del episodio activo se editan desde Preparación. Cambiar el episodio no cambia automáticamente las escenas de OBS.</p>
            </section>}
          </div>
        </div>}

        {!isLoading && tab === 'assets' && <div className="space-y-5">
          <section className={`${panel} flex flex-wrap items-center justify-between gap-3 p-5`}>
            <div><h2 className="text-sm font-bold text-white">Medios de producción</h2><p className="mt-1 text-xs text-slate-400">Sube imágenes, videos y audio a la biblioteca local. Máximo 150 MB por archivo.</p></div>
            <div className="flex flex-wrap items-center gap-2"><select aria-label="Filtrar recursos por tipo" className="rounded-xl border border-white/10 bg-[#16171C] px-3 py-2 text-xs text-white" value={typeFilter} onChange={e=>setTypeFilter(e.target.value as typeof typeFilter)}><option value="all">Todos los tipos</option><option value="image">Imágenes</option><option value="video">Videos</option><option value="audio">Audio</option></select><button className={subtleButton} title="Vista cuadrícula" onClick={()=>void updateSettings({...library.settings,assetView:'grid'})}><LayoutGrid size={15}/></button><button className={subtleButton} title="Vista lista" onClick={()=>void updateSettings({...library.settings,assetView:'list'})}><List size={15}/></button><button className={primaryButton} disabled={busy} onClick={()=>fileRef.current?.click()}><Upload size={14}/> Importar recursos</button></div>
            <input ref={fileRef} className="hidden" multiple type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/x-wav" onChange={e=>void uploadFiles(e.target.files)}/>
          </section>
          {missingAssets > 0 && <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300"><CircleAlert size={16}/> {missingAssets} recurso(s) sin archivo físico. Si importaste un JSON en otro equipo, vuelve a cargar los medios correspondientes.</div>}
          {filteredAssets.length === 0 && <div className={`${panel} p-12 text-center`}><FolderOpen size={30} className="mx-auto mb-2 text-slate-500"/><p className="text-sm font-semibold text-white">No hay recursos disponibles</p><p className="mt-1 text-xs text-slate-400">Importa tu primer archivo o cambia la búsqueda.</p></div>}
          <div className={library.settings.assetView==='grid'?'grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3':'space-y-3'}>
            {filteredAssets.map(asset => <article key={asset.id} className={`${panel} overflow-hidden ${library.settings.assetView==='list'?'flex flex-wrap items-center gap-4 p-3':'p-3'}`}>
              <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/40 ${library.settings.assetView==='grid'?'mb-3 aspect-video w-full':'h-20 w-32'}`}>
                {asset.isMissing ? <CircleAlert size={25} className="text-amber-400"/> : asset.type === 'image' ? <img src={asset.url} alt={asset.name} className="h-full w-full object-contain"/> : asset.type === 'video' ? <video src={asset.url} className="h-full w-full object-contain" muted preload="metadata" controls/> : asset.type === 'audio' ? <div className="flex flex-col items-center gap-2"><Clapperboard size={20} className="text-[#FF6B00]"/><audio src={asset.url} controls preload="none" className="h-8 max-w-[240px]"/></div> : <FileImage size={24} className="text-slate-300"/>}
              </div>
              <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 title={asset.name} className="truncate text-xs font-bold text-white">{asset.name}</h3><p className="mt-1 text-[10px] text-slate-400">{asset.type.toUpperCase()} · {formatSize(asset.sizeBytes)} · {dateLabel(asset.uploadedAt)}</p></div><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${asset.isMissing?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-400'}`}>{asset.isMissing?'SIN ARCHIVO':'DISPONIBLE'}</span></div>
                <div className="flex flex-wrap gap-1">{(asset.tags || []).slice(0,4).map(t=><span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>)}</div>
                <div className="flex flex-wrap gap-2 pt-1"><button className={subtleButton} onClick={()=>setAssetEditor({...asset})}><Pencil size={12}/> Editar</button><button className={subtleButton} disabled={asset.isMissing} onClick={()=>{void navigator.clipboard.writeText(`${window.location.origin}${asset.url}`).then(()=>onShowToast('success','Enlace copiado')).catch(()=>onShowToast('warning','No se pudo copiar el enlace'));}}><Copy size={12}/> URL</button><a className={subtleButton} href={asset.isMissing?undefined:asset.url} download={asset.name} onClick={e=>{if(asset.isMissing)e.preventDefault();}}><Download size={12}/></a>
                  {asset.type === 'image' && <button className={subtleButton} disabled={asset.isMissing} title="Aplicar como logo del programa" onClick={()=>useAsLogo(asset)}><ImagePlus size={12}/> Mosca</button>}
                  <button className={subtleButton} title="Vincular o desvincular del episodio activo" onClick={()=>void toggleEpisodeAsset(asset)}>{(episode.assetIds||[]).includes(asset.id)?<CheckCircle2 size={12}/>:<Plus size={12}/>} Episodio</button>
                  <button disabled={busy} onClick={()=>void removeAsset(asset)} title="Eliminar de biblioteca" className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"><Trash2 size={13}/></button>
                </div>
              </div>
            </article>)}
          </div>
          <p className="text-xs text-slate-500">Los archivos subidos se guardan en <code>.stdq-runtime/media</code>. El enlace sirve para Browser Sources y elementos HTML; un archivo local de OBS Media Source se configura por separado. La carga no inicia reproducción ni transmisión automáticamente.</p>
        </div>}

        {!isLoading && tab === 'backups' && <div className="space-y-5">
          <section className={`${panel} flex flex-wrap items-center justify-between gap-4 p-5`}><div><h2 className="text-sm font-bold text-white">Respaldo y recuperación</h2><p className="mt-1 text-xs text-slate-400">Los puntos locales guardan el estado actual. El JSON incluye catálogo y configuración, pero no los videos e imágenes físicos.</p></div><div className="flex flex-wrap gap-2"><button className={primaryButton} onClick={createBackup}><Plus size={14}/> Crear respaldo</button><button className={subtleButton} onClick={exportStation}><ArrowDownToLine size={14}/> Exportar estación</button><button className={subtleButton} onClick={()=>importRef.current?.click()}><Upload size={14}/> Importar JSON</button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>void importFile(e.target.files?.[0])}/></div></section>
          <section className={`${panel} overflow-hidden`}><div className="border-b border-white/10 p-4 text-xs font-bold text-white">Puntos de restauración ({backups.length})</div>{backups.length===0 && <p className="p-10 text-center text-xs text-slate-400">Todavía no hay respaldos en este navegador.</p>}{backups.map((b, index) => <div key={`${b.timestamp}-${index}`} className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4"><div className="rounded-xl bg-white/5 p-2 text-slate-300"><Archive size={17}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">#{b.episode.number} {b.episode.title}</p><p className="text-[11px] text-slate-400">{new Date(b.timestamp).toLocaleString('es-CL')} · {b.library?'Con catálogo':'Solo estación'}</p></div><button className={subtleButton} onClick={()=>downloadJSON(`STDQ_snapshot_${index+1}.json`, b)}><Download size={12}/></button><button className={subtleButton} onClick={()=>void restoreBackup(b)}><RotateCcw size={12}/> Restaurar</button><button className="rounded-lg p-2 text-red-400 hover:bg-red-500/10" onClick={()=>{if(!confirmDestructive('¿Eliminar este punto de restauración?'))return;StorageService.deleteBackup(b.timestamp);setBackups(StorageService.getBackups());}}><Trash2 size={13}/></button></div>)}</section>
        </div>}
      </div>

      {assetEditor && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Editar recurso"><div className={`${panel} w-full max-w-lg space-y-4 bg-[#16171C] p-6`}><div className="flex justify-between"><h2 className="text-base font-bold text-white">Editar recurso</h2><button onClick={()=>setAssetEditor(null)}><X size={18}/></button></div><label className="block space-y-1 text-xs text-slate-400">Nombre<input className={field} value={assetEditor.name} onChange={e=>setAssetEditor({...assetEditor,name:e.target.value})}/></label><label className="block space-y-1 text-xs text-slate-400">Etiquetas<input className={field} value={(assetEditor.tags||[]).join(', ')} onChange={e=>setAssetEditor({...assetEditor,tags:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)})}/></label><label className="block space-y-1 text-xs text-slate-400">Notas<textarea className={field} rows={3} value={assetEditor.notes||''} onChange={e=>setAssetEditor({...assetEditor,notes:e.target.value})}/></label><p className="break-all font-mono text-[10px] text-slate-500">{assetEditor.url}</p><div className="flex justify-end gap-2"><button className={subtleButton} onClick={()=>setAssetEditor(null)}>Cancelar</button><button className={primaryButton} disabled={busy} onClick={()=>void saveAssetEditor()}><Save size={13}/> Guardar</button></div></div></div>}

      {showSettings && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Preferencias de Biblioteca"><div className={`${panel} w-full max-w-lg space-y-5 bg-[#16171C] p-6`}><div className="flex items-center justify-between"><h2 className="text-base font-bold text-white">Preferencias de Biblioteca</h2><button onClick={()=>setShowSettings(false)}><X size={18}/></button></div><label className="block space-y-2 text-xs text-slate-400">Pestaña inicial<select value={library.settings.startTab} className={field} onChange={e=>void updateSettings({...library.settings,startTab:e.target.value as LibrarySettings['startTab']})}><option value="episodes">Episodios</option><option value="assets">Recursos</option><option value="backups">Respaldos</option></select></label><label className="block space-y-2 text-xs text-slate-400">Vista de recursos<select value={library.settings.assetView} className={field} onChange={e=>void updateSettings({...library.settings,assetView:e.target.value as LibrarySettings['assetView']})}><option value="grid">Cuadrícula</option><option value="list">Lista</option></select></label><label className="flex items-center gap-3 text-xs text-slate-300"><input type="checkbox" checked={library.settings.confirmDeletion} onChange={e=>void updateSettings({...library.settings,confirmDeletion:e.target.checked})}/> Confirmar antes de eliminar recursos y episodios</label><label className="flex items-center gap-3 text-xs text-slate-300"><input type="checkbox" checked={library.settings.backupBeforeSwitch} onChange={e=>void updateSettings({...library.settings,backupBeforeSwitch:e.target.checked})}/> Crear respaldo antes de activar otro episodio</label><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">Los respaldos del navegador pueden perderse al borrar los datos del sitio. Exporta el JSON y conserva por separado la carpeta .stdq-runtime/media.</div><button className={`${primaryButton} w-full`} onClick={()=>setShowSettings(false)}>Cerrar preferencias</button></div></div>}
    </div>
  );
};
