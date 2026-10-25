import React, { useState, useEffect, useRef } from 'react';
import { matchingLiveSources, listBindableSources, liveBindingReport } from '../../utils/liveSources';
import { 
  EpisodeData, 
  OBSStatus, 
  CountdownState,
  ComponentType,
  EditorialComponentConfig,
  CustomComponentRegistry
} from '../../types';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Radio, 
  Tv, 
  Sliders, 
  Clock, 
  Layers, 
  Shield, 
  ShieldAlert, 
  AlertCircle,
  Eye,
  EyeOff,
  Video,
  Flame,
  Check,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { formatTime } from '../../utils/animationEngine';

interface BroadcastControlSpaceProps {
  episode: EpisodeData;
  obsStatus: OBSStatus;
  countdown: CountdownState;
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents: CustomComponentRegistry;
  onCreateCustomSource:(id:string,sceneName:string)=>Promise<string>;
  onUpdateCustomSourceLink:(config:EditorialComponentConfig)=>void;
  isProtectedMode: boolean;
  pendingComponents: string[];
  transitionPending: boolean;
  scenePending: boolean;
  liveFeedback: string;
  focusGraphicId?: string | null;
  onClearGraphicFocus: () => void;
  onSetPreviewScene: (sceneName: string) => void;
  onSetProgramScene: (sceneName: string) => void;
  onExecuteTransition: (transitionType?: string) => void;
  onToggleComponentVisibility: (type: string, sourceName?: string) => void;
  onHideAllComponents: () => void;
  onReplayGraphic:(id:string,sourceName?:string)=>void;
  onEditGraphic:(id:string)=>void;
  onStartCountdown: (seconds: number) => void;
  onPauseCountdown: () => void;
  onResetCountdown: () => void;
  onToggleVirtualCam: () => void;
  onToggleStudioMode: () => void;
}

export const BroadcastControlSpace: React.FC<BroadcastControlSpaceProps> = ({
  episode,
  obsStatus,
  countdown,
  components,
  customComponents,
  onCreateCustomSource,
  onUpdateCustomSourceLink,
  isProtectedMode,
  pendingComponents,
  transitionPending,
  scenePending,
  liveFeedback,
  focusGraphicId,
  onClearGraphicFocus,
  onSetPreviewScene,
  onSetProgramScene,
  onExecuteTransition,
  onToggleComponentVisibility,
  onHideAllComponents,
  onReplayGraphic,
  onEditGraphic,
  onStartCountdown,
  onPauseCountdown,
  onResetCountdown,
  onToggleVirtualCam,
  onToggleStudioMode,
}) => {
  // Links belong to a specific OBS scene; never map a graphic to the webcam by accident.
  const [links, setLinks] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('stdq_live_source_links_v1') || '{}'); }
    catch { return {}; }
  });
  const [editLinks, setEditLinks] = useState(false);
  const [creatingSource,setCreatingSource]=useState<string|null>(null);
  const [selectedTransition, setSelectedTransition] = useState('');
  const [detailGraphic,setDetailGraphic]=useState<string|null>(null);
  const [graphicSearch,setGraphicSearch] = useState('');
  const [compactDesk,setCompactDesk] = useState(() => {
    try { return localStorage.getItem('stdq-v42-live-compact-v1') !== '0'; }
    catch { return true; }
  });
  const toggleCompactDesk = () => {
    const next = !compactDesk;
    setCompactDesk(next);
    try { localStorage.setItem('stdq-v42-live-compact-v1', next ? '1' : '0'); } catch {}
  };
  const [graphicFilter,setGraphicFilter] = useState<'all'|'visible'|'issues'>('all');
  const focusedGraphicRef = useRef<HTMLDivElement>(null);
  const program = obsStatus.scenes.find(scene => scene.name === obsStatus.currentProgramScene);
  const programSources = program?.sources || [];
  const bindableSources = listBindableSources(programSources);
  const availableTransitions = obsStatus.availableTransitions || [];
  const report=liveBindingReport(programSources,[...Object.values(components),...Object.values(customComponents)],
    config=>config.instanceId?(config.obsSourceLinks?.[obsStatus.currentProgramScene]||''):(links[`${obsStatus.currentProgramScene}::${config.type}`]||''));
  const focusExists = !focusGraphicId || !!customComponents[focusGraphicId] || Object.prototype.hasOwnProperty.call(components,focusGraphicId);
  useEffect(() => {
    if (focusGraphicId && focusExists) focusedGraphicRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }, [focusGraphicId,focusExists]);

  const activeTransition = availableTransitions.includes(selectedTransition) ? selectedTransition
    : availableTransitions.includes(obsStatus.currentTransitionName || '') ? obsStatus.currentTransitionName!
    : availableTransitions[0] || '';

  useEffect(() => {
    try { localStorage.setItem('stdq_live_source_links_v1', JSON.stringify(links)); } catch {}
  }, [links]);

  const linkKey = (type: string) => `${obsStatus.currentProgramScene}::${type}`;
  const linkedSource = (config:EditorialComponentConfig):string =>
    config.instanceId ? (config.obsSourceLinks?.[obsStatus.currentProgramScene] || '') : (links[linkKey(config.type)] || '');
  const changeLink = (type: string, value: string) => {
    const custom=customComponents[type];
    if(custom){
      const next={...(custom.obsSourceLinks||{})};
      if(value)next[obsStatus.currentProgramScene]=value;
      else delete next[obsStatus.currentProgramScene];
      onUpdateCustomSourceLink({...custom,obsSourceLinks:next,updatedAt:new Date().toISOString()});
    }
    setLinks(previous => {
      const updated = { ...previous };
      if (value) updated[linkKey(type)] = value;
      else delete updated[linkKey(type)];
      return updated;
    });
  };

  const componentLabels: { type: ComponentType; label: string; code: string }[] = [
    { type: 'lower-third', label: 'Lower Third', code: 'DSK 01' },
    { type: 'banner', label: 'Banner Frase', code: 'DSK 02' },
    { type: 'question', label: 'Pregunta', code: 'DSK 03' },
    { type: 'chapter', label: 'Capítulo', code: 'DSK 04' },
    { type: 'section', label: 'Sección', code: 'DSK 05' },
    { type: 'quote', label: 'Cita', code: 'DSK 06' },
    { type: 'scripture', label: 'Versículo', code: 'DSK 07' },
    { type: 'social-pill', label: 'Social Pill', code: 'USK 01' },
    { type: 'social', label: 'Redes Box', code: 'USK 02' },
    { type: 'logo-bug', label: 'Mosca Logo', code: 'USK 03' },
    { type: 'ticker', label: 'Ticker Info', code: 'DSK 08' },
    { type: 'editorial', label: 'Editorial', code: 'DSK 09' },
    { type: 'waiting', label: 'Pantalla Espera', code: 'FSK 01' },
    { type: 'break', label: 'Pantalla Pausa', code: 'FSK 02' },
    { type: 'outro', label: 'Pantalla Cierre', code: 'FSK 03' },
  ];

  // Presentation-only filters: do not modify any OBS source or publication state.
  const displayedGraphics = [
    ...componentLabels,
    ...Object.values(customComponents).map((config, idx)=>({type:config.instanceId!,label:config.name,code:`GFX ${String(idx + 1).padStart(2, '0')}`})),
  ].filter(c=>{
    const config = customComponents[c.type] || components[c.type as ComponentType];
    if (!config) return false;
    const searchLabel = `${c.label} ${config.name} ${c.code}`.toLocaleLowerCase('es');
    if (!searchLabel.includes(graphicSearch.trim().toLocaleLowerCase('es'))) return false;
    const matches = matchingLiveSources(programSources,config,config.type,linkedSource(config));
    const source = matches.length===1 && matches[0].type==='browser_source' ? matches[0] : null;
    const live = !!config.visibleInOBS && !!source?.enabled;
    const needsAttention = !obsStatus.connected || !program || !source || !!(config.visibleInOBS && !source.enabled);
    return graphicFilter==='all' || (graphicFilter==='visible' && live) || (graphicFilter==='issues' && needsAttention);
  });

  const visiblePublishedGraphics = [
    ...Object.values(components),
    ...Object.values(customComponents),
  ].filter(config => config.visibleInOBS && matchingLiveSources(programSources,config,config.type,linkedSource(config))
    .some(source => source.type==='browser_source' && source.enabled));

  const previewSceneLabel = obsStatus.connected && obsStatus.studioMode
    ? obsStatus.currentPreviewScene || 'Sin escena Preview'
    : 'Preview no disponible';
  const programSceneLabel = obsStatus.connected
    ? obsStatus.currentProgramScene || 'Sin escena Program'
    : 'OBS desconectado';

  const handleSceneSelect = (sceneName: string) => {
    if (obsStatus.studioMode) {
      onSetPreviewScene(sceneName);
    } else {
      onSetProgramScene(sceneName);
    }
  };


  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-3.5 space-y-3 max-w-[1720px] mx-auto w-full animate-in fade-in duration-150 select-none">
      {/* 1. ATEM Master Realization Status & Emergency DSK Strip */}
      <div className="atem-module px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#06080b] border border-[#222834]">
            <span className="relative flex h-2.5 w-2.5">
              {obsStatus.connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-40"/>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${obsStatus.connected ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-slate-600'}`} />
            </span>
            <span className="text-[11px] font-mono font-black uppercase tracking-[0.12em] text-white">
              M/E 1 · SWITCHER EN VIVO
            </span>
          </div>

          <div className="atem-readout px-2.5 py-1 text-xs text-slate-300 truncate max-w-[320px]" title={episode.title}>
            <span className="text-[10px] text-slate-500 mr-1.5">EP #{episode.number}</span>
            <strong className="text-slate-100 font-sans">{episode.title}</strong>
          </div>

          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold ${
            obsStatus.connected
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
              : 'bg-red-950/40 text-red-300 border-red-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected ? 'bg-emerald-400 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`} />
            <span>{obsStatus.connected ? `WS ONLINE · ${obsStatus.latencyMs}ms` : 'WS OFFLINE'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button type="button" aria-pressed={compactDesk} onClick={toggleCompactDesk}
            className="atem-btn px-2.5 py-1.5 text-[11px] font-bold"
            title="Cambiar altura de los monitores esquemáticos sin afectar video ni OBS">
            {compactDesk ? 'Ampliar monitores' : 'Compactar monitores'}
          </button>

          {/* Studio Mode Hardware Toggle */}
          <button
            type="button"
            disabled={!obsStatus.connected || transitionPending || (isProtectedMode && obsStatus.studioMode)}
            onClick={onToggleStudioMode}
            aria-pressed={obsStatus.studioMode}
            title={isProtectedMode && obsStatus.studioMode?'Modo Protegido impide desactivar Modo Estudio':obsStatus.studioMode?'Modo Estudio activo: elegir escenas prepara Preview':'Modo Estudio desactivado: elegir escenas puede cambiar Program directamente'}
            className={`atem-btn px-2.5 py-1.5 text-[11px] font-mono font-bold ${
              obsStatus.studioMode ? 'atem-btn-pvw' : ''
            }`}
          >
            MODO ESTUDIO: {obsStatus.studioMode ? 'ON' : 'OFF'}
          </button>

          <span className={`rounded px-2.5 py-1.5 text-[11px] font-mono font-bold border ${obsStatus.studioMode?'border-emerald-500/40 text-emerald-300 bg-emerald-950/30':'border-amber-500/40 text-amber-300 bg-amber-950/30'}`} role="status">
            {obsStatus.studioMode ? 'BUS ESCENA → PREVIEW' : 'ATENCIÓN: BUS → PROGRAM'}
          </span>

          <div className="flex items-center gap-2 border-l border-[#252b37] pl-2.5" aria-label="Acción de emergencia">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-red-400 hidden 2xl:inline">
              DSK MASTER ({visiblePublishedGraphics.length})
            </span>
            <button type="button" disabled={!obsStatus.connected || pendingComponents.length > 0} onClick={onHideAllComponents}
              className={`atem-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold ${visiblePublishedGraphics.length > 0 ? 'atem-btn-pgm' : 'border-red-500/40 text-red-200'}`}
              title="Ocultar las gráficas de OBS sin cambiar la escena Program">
              <EyeOff className="w-3.5 h-3.5"/> Despejar gráficas
            </button>
          </div>
        </div>
      </div>

      {/* Handoff Focus Alerts from Content Studio */}
      {focusGraphicId && focusExists && <div role="status" className="rounded-md border border-sky-400/50 bg-sky-950/30 px-3.5 py-2 text-xs text-sky-100 flex flex-wrap items-center justify-between gap-2 shadow-[inset_3px_0_0_#38bdf8]">
        <span>Canal enfocado desde Diseñar: <strong className="font-mono text-white">{customComponents[focusGraphicId]?.name || components[focusGraphicId as ComponentType]?.name || focusGraphicId}</strong>. Verifica su fuente y pulsa «Mostrar en Program» cuando deba salir al aire.</span>
        <button type="button" className="atem-btn px-2.5 py-1 text-[11px] font-bold" onClick={onClearGraphicFocus}>Quitar selección</button>
      </div>}
      {focusGraphicId && !focusExists && <div role="status" className="rounded-md border border-amber-500/50 bg-amber-950/30 px-3.5 py-2 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2 shadow-[inset_3px_0_0_#f59e0b]">
        <span>La gráfica seleccionada todavía no está publicada para En Vivo. Publica su diseño desde Diseñar antes de vincularla a OBS.</span>
        <div className="flex items-center gap-2">
          <button type="button" className="atem-btn px-2.5 py-1 text-[11px] font-bold" onClick={()=>onEditGraphic(focusGraphicId)}>Volver a Diseñar</button>
          <button type="button" className="atem-btn px-2.5 py-1 text-[11px] font-bold" onClick={onClearGraphicFocus}>Cerrar aviso</button>
        </div>
      </div>}

      {/* Telemetry Strip */}
      <div className="live-production-status" role="status">
        <div><span>CONEXIÓN OBS</span><strong>{obsStatus.connected?'Control disponible':'OBS desconectado'}</strong></div>
        <div><span>ESCENA EN PROGRAM</span><strong className="text-red-400">{obsStatus.currentProgramScene||'Sin detectar'}</strong></div>
        <div><span>MODO ESTUDIO</span><strong className={obsStatus.studioMode?'text-emerald-400':'text-amber-300'}>{obsStatus.studioMode?'Preview protegido':'Cambio directo de escenas'}</strong></div>
        <div><span>PROTECCIÓN</span><strong className={isProtectedMode?'text-amber-300':'text-slate-300'}>{isProtectedMode?'Acciones directas protegidas':'Modo protegido desactivado'}</strong></div>
        <div><span>OPERACIONES</span><strong>{pendingComponents.length?`${pendingComponents.length} en curso`:'Sin operaciones pendientes'}</strong></div>
      </div>

      {/* 2. TOP MULTIVIEWER SCHEMATIC MONITORS: PREVIEW (GREEN) | PROGRAM (RED) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* PREVIEW MONITOR (GREEN TALLY) */}
        <div className="atem-module border-2 border-emerald-500/70 overflow-hidden flex flex-col shadow-[0_0_20px_rgba(34,197,94,0.12)]">
          <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-950/80 via-[#111815] to-[#11141a] border-b border-emerald-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${obsStatus.connected && obsStatus.studioMode?'bg-emerald-400 shadow-[0_0_8px_#22c55e]':'bg-slate-600'}`} />
              <span className="text-[11px] font-mono font-black uppercase tracking-[0.12em] text-emerald-300">
                PREVIEW · PREPARACIÓN
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-200 atem-readout px-2.5 py-0.5">
              {previewSceneLabel}
            </span>
          </div>

          <div className={`relative bg-[#05070a] monitor-grid flex items-center justify-center overflow-hidden ${compactDesk?'h-[118px] lg:h-[136px]':'aspect-video max-h-[260px]'}`}>
            {/* Broadcast Safe Area Crosshair */}
            <div className="absolute inset-3 border border-emerald-500/15 pointer-events-none rounded-[2px]" />
            <div className={`text-center z-10 ${compactDesk?'space-y-1 px-3 py-1.5':'space-y-2 p-5'}`}>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                <Tv className="w-3 h-3" /> PVW BUS
              </div>
              <div className="text-base font-black text-white tracking-tight font-mono">
                {previewSceneLabel}
              </div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                {compactDesk?'Representación de estado · no muestra video': 'Escena en preparación. Representación de estado · no muestra video. Al ejecutar AUTO TRANS, conmuta hacia Program.'}
              </p>
            </div>

            <div className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded bg-[#06080b]/90 border border-emerald-500/40 text-[9px] text-emerald-400 font-mono font-bold">
              PVW STANDBY
            </div>
          </div>

          <div className="px-3 py-1.5 bg-[#0b0e13] border-t border-[#1f2532] flex items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
            <span>{obsStatus.connected && obsStatus.studioMode ? 'LISTO PARA TRANSICIÓN' : 'ACTIVA MODO ESTUDIO PARA USAR PREVIEW'}</span>
            <span className="text-emerald-400 font-bold">PVW ➔ PGM</span>
          </div>
        </div>

        {/* PROGRAM MONITOR (RED TALLY ON-AIR) */}
        <div className="atem-module border-2 border-red-500 overflow-hidden flex flex-col shadow-[0_0_24px_rgba(239,68,68,0.18)]">
          <div className="px-3.5 py-2 bg-gradient-to-r from-red-950/85 via-[#1a1114] to-[#11141a] border-b border-red-500/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {obsStatus.connected && program && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${obsStatus.connected && program?'bg-red-500 shadow-[0_0_8px_#ef4444]':'bg-slate-600'}`} />
              </span>
              <span className="text-[11px] font-mono font-black uppercase tracking-[0.12em] text-red-300">
                PROGRAM · SALIDA OBS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-black ${obsStatus.connected && program?'bg-red-600 text-white border-red-400':'bg-white/5 text-slate-400 border-white/10'}`}>
                {obsStatus.connected && program ? 'ON AIR' : 'SIN DATOS'}
              </span>
              <span className="text-xs font-mono font-bold text-white atem-readout px-2.5 py-0.5">
                {programSceneLabel}
              </span>
            </div>
          </div>

          <div className={`relative bg-[#05070a] monitor-grid flex items-center justify-center overflow-hidden ${compactDesk?'h-[118px] lg:h-[136px]':'aspect-video max-h-[260px]'}`}>
            <div className="absolute inset-3 border border-red-500/20 pointer-events-none rounded-[2px]" />
            <div className={`text-center z-10 ${compactDesk?'space-y-1 px-3 py-1.5':'space-y-2 p-5'}`}>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-[10px] font-mono font-bold text-red-300 uppercase">
                <Radio className="w-3 h-3" /> PGM BUS
              </div>
              <div className="text-base font-black text-white tracking-tight font-mono">
                {programSceneLabel}
              </div>
              <p className="text-[11px] text-slate-300 max-w-md mx-auto">
                {compactDesk?'Representación de estado · confirmar en OBS': 'Vista esquemática de Program · no muestra video real. Confirma la señal en el monitor de OBS.'}
              </p>
            </div>

            {/* Active Graphic Overlays Indicators on Program */}
            <div className="absolute top-2 left-2.5 flex flex-wrap gap-1 max-w-[75%]">
              {visiblePublishedGraphics.map(c => (
                <span key={c.id} className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-red-950/90 text-red-200 border border-red-500/50 shadow">
                  ● {c.name}
                </span>
              ))}
            </div>

            <div className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded bg-[#06080b]/90 border border-red-500/40 text-[9px] text-red-400 font-mono font-bold">
              TELEMETRÍA PGM
            </div>
          </div>

          <div className="px-3 py-1.5 bg-[#0b0e13] border-t border-[#1f2532] flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-300 font-mono">
            <span>{visiblePublishedGraphics.length} CAPA{visiblePublishedGraphics.length===1?'':'S'} DSK ACTIVA{visiblePublishedGraphics.length===1?'':'S'} · verificar video en OBS</span>
            <span className={`font-bold ${obsStatus.virtualCamActive?'text-sky-400':'text-slate-500'}`}>
              {obsStatus.virtualCamActive ? 'CAM VIRTUAL: ON' : 'CAM VIRTUAL: OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. M/E 1 SWITCHER BUSES + TRANSITION CONTROL BLOCK */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Scene Switcher Bank (8 columns) */}
        <div className="xl:col-span-8 atem-module flex flex-col justify-between">
          <div className="atem-module-header">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <h3 className="atem-label text-white">M/E 1 · BANCO DE ESCENAS OBS (PROGRAM / PREVIEW BUS)</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                {obsStatus.studioMode
                  ? 'CLIC PREPARA EN PREVIEW'
                  : isProtectedMode
                  ? 'PROTEGIDO: BLOQUEO DIRECTO'
                  : 'CLIC CONMUTA PROGRAM DIRECTO'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#06080b] border border-[#252b37] text-[10px] font-mono font-bold text-sky-400">
                {obsStatus.scenes.length} ESCENAS
              </span>
            </div>
          </div>

          <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
            <div className="atem-well grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-[195px] overflow-y-auto">
              {obsStatus.scenes.length===0 && <div role="status" className="col-span-full rounded border border-[#252b37] bg-[#0d1016] p-4 text-xs text-slate-300 font-mono text-center">
                {obsStatus.connected ? 'OBS CONECTADO · SIN ESCENAS DETECTADAS EN COLECCIÓN ACTIVA' : 'CONECTA OBS STUDIO PARA HABILITAR LOS BUSES DE ESCENAS'}
              </div>}
              {obsStatus.scenes.map((scene, idx) => {
                const isProgram = obsStatus.currentProgramScene === scene.name;
                const isPreview = obsStatus.currentPreviewScene === scene.name;
                const chCode = `SC ${String(idx + 1).padStart(2, '0')}`;

                let btnClass = 'atem-btn';
                if (isProgram) btnClass = 'atem-btn atem-btn-pgm';
                else if (isPreview) btnClass = 'atem-btn atem-btn-pvw';

                return (
                  <button
                    key={scene.id}
                    type="button"
                    disabled={!obsStatus.connected || transitionPending || scenePending || (!obsStatus.studioMode && isProtectedMode)}
                    onClick={() => handleSceneSelect(scene.name)}
                    title={obsStatus.studioMode ? `Preparar «${scene.name}» en Preview sin cambiar Program` : isProtectedMode ? 'Modo Protegido impide cambiar Program directamente' : `Enviar «${scene.name}» directamente a Program (Modo Estudio desactivado)`}
                    aria-label={obsStatus.studioMode ? `Preparar escena ${scene.name} en Preview` : `Enviar escena ${scene.name} directamente a Program`}
                    className={`${btnClass} flex flex-col justify-between p-2.5 min-h-[64px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400`}
                  >
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      <span className="text-[9px] font-mono font-bold text-slate-400 bg-black/50 px-1.5 py-0.2 rounded border border-white/5">
                        {chCode}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isProgram && (
                          <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-mono font-black uppercase tracking-wider shadow">
                            PGM
                          </span>
                        )}
                        {isPreview && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 text-[9px] font-mono font-black uppercase tracking-wider">
                            PVW
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-extrabold text-white truncate w-full mt-1.5" title={scene.name}>
                      {scene.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                {obsStatus.studioMode
                  ? 'Seleccionar escena asigna el bus PREVIEW (Verde); la señal PROGRAM (Rojo) no cambia hasta ejecutar transición.'
                  : isProtectedMode
                  ? 'Modo Protegido activo: desactiva la protección o activa Modo Estudio para conmutar escenas.'
                  : 'Modo directo activo: pulsar una escena conmuta inmediatamente la salida PROGRAM.'}
              </span>
            </div>
          </div>
        </div>

        {/* Transition Control Module (4 columns) */}
        <section className="xl:col-span-4 atem-module flex flex-col justify-between" aria-label="Transiciones OBS">
          <div className="atem-module-header">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="atem-label text-white">TRANSITION CONTROL · M/E 1</h3>
            </div>
            <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded border ${obsStatus.studioMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' : 'bg-amber-950/60 text-amber-300 border-amber-500/40'}`}>
              {obsStatus.studioMode ? 'STUDIO MODE ON' : 'ACTIVA MODO ESTUDIO'}
            </span>
          </div>

          <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            {/* Transition Routing Readout */}
            <div className="atem-readout p-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">DESDE PREVIEW</span>
                <strong className="text-white truncate block">{obsStatus.currentPreviewScene || '—'}</strong>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1 text-right">
                <span className="text-[9px] text-red-400 font-bold uppercase block">HACIA PROGRAM</span>
                <strong className="text-white truncate block">{obsStatus.currentProgramScene || '—'}</strong>
              </div>
            </div>

            {/* Transition Style & AUTO Execution */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-400 shrink-0">ESTILO OBS:</label>
                <select
                  value={activeTransition}
                  onChange={event => setSelectedTransition(event.target.value)}
                  disabled={!obsStatus.connected || !availableTransitions.length || transitionPending}
                  className="flex-1 rounded glass-input text-white text-xs font-mono px-2.5 py-1.5 disabled:opacity-50"
                  aria-label="Transición instalada en OBS"
                >
                  {!availableTransitions.length && <option value="">Sin transiciones detectadas</option>}
                  {availableTransitions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              <button
                type="button"
                disabled={!obsStatus.connected || !obsStatus.studioMode || !obsStatus.currentPreviewScene || transitionPending || scenePending || !activeTransition}
                onClick={() => onExecuteTransition(activeTransition)}
                className={`w-full py-3 px-4 rounded font-mono font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 ${
                  obsStatus.connected && obsStatus.studioMode && obsStatus.currentPreviewScene
                    ? 'atem-btn-pgm text-white shadow-[0_0_20px_rgba(239,68,68,0.28)]'
                    : 'atem-btn text-slate-300'
                }`}
              >
                {transitionPending
                  ? 'EJECUTANDO TRANSICIÓN EN OBS…'
                  : `AUTO TRANS · Enviar ${obsStatus.currentPreviewScene || 'Preview'} a Program · ${activeTransition || 'transición'}`}
              </button>
            </div>

            {!obsStatus.studioMode && <p className="text-amber-300 text-[11px] leading-snug">Activa Modo Estudio antes de utilizar transiciones. Si está desactivado, el bus conmuta Program directamente.</p>}
            {obsStatus.studioMode && !obsStatus.currentPreviewScene && <p className="text-amber-300 text-[11px] leading-snug">No hay una escena preparada en Preview. Selecciona una escena antes de transicionar.</p>}
            {obsStatus.studioMode && availableTransitions.length === 0 && <p className="text-amber-300 text-[11px] leading-snug">No se recibió el catálogo de transiciones de OBS.</p>}

            <div role="status" aria-live="polite" className="atem-readout px-2.5 py-1.5 text-[11px] text-slate-300 truncate" title={liveFeedback}>
              {liveFeedback}
            </div>
          </div>
        </section>
      </div>

      {/* 4. DOWNSTREAM KEYERS & GRAPHICS MATRIX (DSK CHANNELS) */}
      <div className="atem-module overflow-hidden">
        <div className="atem-module-header flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-red-400" />
            <h3 className="atem-label text-white">
              DOWNSTREAM KEYERS · MATRIZ DE GRÁFICAS EN PROGRAM ({componentLabels.length + Object.keys(customComponents).length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => setEditLinks(!editLinks)}
              className={`atem-btn px-2.5 py-1 text-[11px] font-bold ${editLinks ? 'border-sky-400 text-sky-300' : ''}`}
              aria-expanded={editLinks}
            >
              {editLinks ? 'Cerrar vínculos OBS' : 'Configurar fuentes OBS'}
            </button>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/50 border border-red-500/40 text-red-300 font-bold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" /> ON AIR ({visiblePublishedGraphics.length})
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#06080b] border border-[#252b37] text-slate-400 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-slate-600" /> STANDBY
            </span>
          </div>
        </div>

        <div className="p-3.5 space-y-3">
          {/* Filter & Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5" aria-label="Buscar y filtrar gráficas">
            <label className="flex-1 min-w-[200px] max-w-sm">
              <span className="sr-only">Buscar gráfica por nombre</span>
              <input type="search" value={graphicSearch} onChange={e=>setGraphicSearch(e.target.value)}
                placeholder="Filtrar canal o gráfica (ej. DSK 01, Lower Third)…" aria-label="Buscar una gráfica"
                className="w-full rounded glass-input px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-500" />
            </label>

            <div className="live-connection-summary flex-1 justify-end" role="status" aria-live="polite">
              <span><strong>{report.verified}</strong> detectadas</span>
              <span><strong>{report.live}</strong> fuentes visibles</span>
              <span className={report.missing?'text-amber-300':''}><strong>{report.missing}</strong> sin vincular</span>
              {report.ambiguous>0&&<span className="text-red-300"><strong>{report.ambiguous}</strong> ambiguas</span>}
              <span className="text-slate-500 hidden xl:inline">Datos de fuentes OBS; video no verificado</span>
            </div>

            <div role="group" aria-label="Filtrar gráficas por estado" className="atem-well flex items-center gap-1">
              {([
                ['all','Todas'],['visible','En Program'],['issues','Por revisar'],
              ] as const).map(([id,label])=>(
                <button type="button" key={id} aria-pressed={graphicFilter===id} onClick={()=>setGraphicFilter(id)}
                  className={`rounded-[3px] px-2.5 py-1 text-[11px] font-bold transition-colors ${graphicFilter===id?'bg-[#232a38] text-white border border-sky-400/60':'text-slate-400 hover:text-white'}`}>{label}</button>
              ))}
            </div>
          </div>

          {/* High-Density DSK Channel Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {displayedGraphics.map((c) => {
              const config = customComponents[c.type] || components[c.type as ComponentType];
              if (!config) return null;
              const linked = linkedSource(config);
              // Custom graphics MUST be explicitly linked to the browser source with their own URL.
              const matches = matchingLiveSources(programSources, config, config.type, linked);
              const source = matches.length === 1 && matches[0].type === 'browser_source' ? matches[0] : null;
              const pending = pendingComponents.includes(c.type);
              const unavailable = !obsStatus.connected || !program || !source;
              const isLive = !!config.visibleInOBS && !!source?.enabled;
              const status = !obsStatus.connected ? 'OBS DESCONECTADO'
                : !program ? 'SIN ESCENA PROGRAM'
                : !source ? matches.length > 1 ? 'VÍNCULO AMBIGUO' : 'FUENTE NO VINCULADA'
                : pending ? 'APLICANDO…'
                : isLive ? 'VISIBLE EN PROGRAM'
                : config.visibleInOBS && !source.enabled ? 'FUENTE OBS DESACTIVADA'
                : 'LISTO EN STANDBY';

              const primaryPreview =
                config.content?.primaryText ||
                config.content?.title ||
                config.content?.question ||
                config.content?.quote ||
                config.name ||
                c.label;

              return (
                <div
                  key={c.type}
                  ref={focusGraphicId===c.type?focusedGraphicRef:undefined}
                  className={`min-w-0 rounded-md border bg-[#0c0f14] p-2.5 flex flex-col justify-between gap-2 relative overflow-hidden transition-colors ${
                    isLive
                      ? 'border-red-500/80 shadow-[0_0_16px_rgba(239,68,68,0.16)]'
                      : focusGraphicId===c.type
                      ? 'border-sky-400 ring-1 ring-sky-400/40'
                      : unavailable
                      ? 'border-[#262c38]'
                      : 'border-emerald-500/35'
                  }`}
                >
                  {/* Top Hardware Tally Bar */}
                  <span className={`absolute inset-x-0 top-0 h-[3px] ${
                    isLive
                      ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                      : pending
                      ? 'bg-amber-400 animate-pulse'
                      : unavailable
                      ? 'bg-amber-500/50'
                      : 'bg-emerald-500/70'
                  }`} />

                  <div className="flex flex-col gap-1.5 pt-1" role="group" aria-label={`Estado de ${c.label}`}>
                    <div className="flex justify-between items-center gap-1.5">
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-[#05070a] text-slate-300 border border-[#222834]">
                        {c.code}
                      </span>
                      <span role="status" className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isLive
                          ? 'bg-red-600 text-white border-red-400'
                          : unavailable
                          ? 'bg-amber-950/50 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <strong className="text-xs font-extrabold text-white truncate" title={c.label}>{c.label}</strong>
                      {focusGraphicId===c.type && <span className="text-[9px] font-mono text-sky-400 font-bold shrink-0">FOCO</span>}
                    </div>

                    {/* Recessed Content & Source Readout */}
                    <div className="atem-readout px-2 py-1.5 space-y-0.5">
                      <div className="text-[11px] text-slate-200 truncate font-sans font-medium" title={String(primaryPreview)}>
                        {String(primaryPreview)}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate">
                        OBS: <span className={source ? 'text-slate-300' : 'text-amber-400'}>{source?.name || 'Sin fuente vinculada'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <button type="button"
                      disabled={unavailable || pending || transitionPending || scenePending}
                      onClick={() => onToggleComponentVisibility(c.type, linked || source?.name)}
                      aria-label={`${pending?'Aplicando':isLive?'Ocultar de Program':'Mostrar en Program'}: ${c.label}`}
                      title={source ? `Fuente OBS: ${source.name} · Escena Program: ${obsStatus.currentProgramScene}` : 'No hay una fuente de navegador válida para esta gráfica en Program'}
                      className={`w-full min-h-9 px-2.5 py-2 text-xs font-mono font-black uppercase tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                        isLive
                          ? 'atem-btn atem-btn-pgm'
                          : 'atem-btn atem-btn-pvw'
                      }`}>
                      {pending?'Aplicando…':isLive?'Ocultar de Program':'Mostrar en Program'}
                    </button>

                    {obsStatus.connected && program && !source && <button type="button"
                      onClick={()=>{setEditLinks(true);setDetailGraphic(c.type);}}
                      className="atem-btn atem-btn-amber w-full px-2 py-1.5 text-[11px] font-bold"
                      title="Revisar o vincular una fuente de navegador válida de esta gráfica en la escena Program">
                      {matches.length>1?'Resolver vínculo ambiguo':'Revisar fuente OBS'}
                    </button>}

                    <div className="live-graphic-actions">
                      <button type="button" onClick={()=>onEditGraphic(c.type)} title="Abrir esta gráfica en Content Studio">Editar</button>
                      <button type="button" onClick={()=>setDetailGraphic(old=>old===c.type?null:c.type)} aria-expanded={detailGraphic===c.type}>Detalles</button>
                      <button type="button" disabled={!isLive||pending} title="Reproducir la animación publicada sin cambiar su diseño" onClick={()=>onReplayGraphic(c.type,linked||source?.name)}>↻ Motion</button>
                    </div>

                    {detailGraphic===c.type && <div className="live-graphic-details">
                      <div><span>Animación</span><strong>{config.animation.preset}</strong></div>
                      <div><span>Entrada / Salida</span><strong>{config.animation.entryDurationMs} / {config.animation.exitDurationMs} ms</strong></div>
                      <div><span>Capas libres</span><strong>{config.layers?.length??0}</strong></div>
                      <div><span>Fuente OBS</span><strong className="break-all">{source?.name||'Sin vínculo válido'}</strong></div>
                    </div>}

                    {config.instanceId && !linked && !source && obsStatus.connected && program && <button type="button" disabled={!!creatingSource} className="atem-btn text-[10px] font-bold w-full mt-1 py-1.5 border-sky-400/40 text-sky-200"
                      onClick={async()=>{
                        if(!window.confirm(`¿Crear una fuente Browser Source para «${config.name}» en la escena «${program.name}»? La fuente quedará DESACTIVADA.`))return;
                        setCreatingSource(config.instanceId!);
                        try{const source=await onCreateCustomSource(config.instanceId!,program.name);changeLink(config.instanceId!,source);}
                        catch(err){window.alert(err instanceof Error?err.message:'No se pudo crear la fuente.');}
                        finally{setCreatingSource(null);}
                      }}>{creatingSource===config.instanceId?'Creando fuente…':'Crear fuente OBS'}</button>}

                    {editLinks && <select
                      aria-label={`Fuente OBS para ${c.label}`}
                      className="w-full mt-1 glass-input rounded text-[11px] font-mono p-1.5 text-white"
                      value={linked || ''}
                      onChange={event => changeLink(c.type, event.target.value)}
                      disabled={!program || pending}
                    >
                      <option value="">Detección automática por URL OBS</option>
                      {linked && !bindableSources.some(item => item.name === linked) && <option value={linked} disabled>Vínculo perdido: {linked}</option>}
                      {bindableSources.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>}
                  </div>
                </div>
              );
            })}
          </div>

          {displayedGraphics.length===0 && <p role="status" className="atem-readout p-4 text-center text-xs text-slate-400">
            No hay canales gráficos que coincidan con el filtro actual. Prueba «Todas» o limpia la búsqueda.
          </p>}
          {editLinks && <p className="text-[11px] font-mono text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded px-3 py-2">
            Si un canal aparece como «FUENTE NO VINCULADA», selecciona su Browser Source exacta en la escena Program de OBS. Los vínculos se guardan por escena.
          </p>}
        </div>
      </div>
    </div>
  );
};
