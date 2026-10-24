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

  const componentLabels: { type: ComponentType; label: string; icon: string }[] = [
    { type: 'lower-third', label: 'Lower Third', icon: '👤' },
    { type: 'banner', label: 'Banner Frase', icon: '💬' },
    { type: 'question', label: 'Pregunta', icon: '❓' },
    { type: 'chapter', label: 'Capítulo', icon: '🏷️' },
    { type: 'section', label: 'Sección', icon: '📌' },
    { type: 'quote', label: 'Cita', icon: '📜' },
    { type: 'scripture', label: 'Versículo', icon: '📖' },
    { type: 'social-pill', label: 'Social Pill', icon: '💊' },
    { type: 'social', label: 'Redes Box', icon: '📱' },
    { type: 'logo-bug', label: 'Mosca Logo', icon: '✨' },
    { type: 'ticker', label: 'Ticker Info', icon: '🔴' },
    { type: 'editorial', label: 'Editorial', icon: '📰' },
    { type: 'waiting', label: 'Pantalla Espera', icon: '⏳' },
    { type: 'break', label: 'Pantalla Pausa', icon: '☕' },
    { type: 'outro', label: 'Pantalla Cierre', icon: '🎬' },
  ];

  // Presentation-only filters: do not modify any OBS source or publication state.
  const displayedGraphics = [
    ...componentLabels,
    ...Object.values(customComponents).map(config=>({type:config.instanceId!,label:config.name,icon:'✦'})),
  ].filter(c=>{
    const config = customComponents[c.type] || components[c.type as ComponentType];
    if (!config || !c.label.toLocaleLowerCase('es').includes(graphicSearch.trim().toLocaleLowerCase('es'))) return false;
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
    <div className="flex-1 overflow-y-auto px-4 py-5 md:p-6 space-y-5 max-w-[1600px] mx-auto w-full animate-in fade-in duration-200">
      {/* Top Realization Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 py-3 glass-panel rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {obsStatus.connected&&<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40"/>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${obsStatus.connected?'bg-emerald-500':'bg-slate-500'}`}></span>
            </span>
            <span className="text-xs font-extrabold uppercase tracking-widest text-white">
              En Vivo · Mesa de realización
            </span>
          </div>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs text-slate-300 truncate max-w-[320px]" title={episode.title}>
            Episodio #{episode.number}: <strong className="text-white">{episode.title}</strong>
          </span>

          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold ${
            obsStatus.connected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{obsStatus.connected ? `OBS CONECTADO (${obsStatus.latencyMs}ms)` : 'OBS DESCONECTADO'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button type="button" aria-pressed={compactDesk} onClick={toggleCompactDesk}
            className="px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 text-xs font-semibold transition-colors"
            title="Cambiar altura de los monitores esquemáticos sin afectar video ni OBS">
            {compactDesk ? 'Ampliar monitores' : 'Compactar monitores'}
          </button>
          {/* Studio Mode Toggle */}
          <button
            disabled={!obsStatus.connected || transitionPending}
            onClick={onToggleStudioMode}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              obsStatus.studioMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            Modo Estudio {obsStatus.studioMode ? 'ON' : 'OFF'}
          </button>

          <span className={`rounded-lg border px-3 py-2 text-xs font-semibold ${obsStatus.studioMode?'border-emerald-500/25 text-emerald-200 bg-emerald-500/10':'border-amber-400/30 text-amber-200 bg-amber-400/10'}`} role="status">
            {obsStatus.studioMode ? 'Seleccionar escena → Preview' : 'Atención: seleccionar escena → Program'}
          </span>
          <div className="flex items-center gap-2 border-l border-rose-500/25 pl-3" aria-label="Acción de emergencia">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 hidden 2xl:inline">Emergencia</span>
            <button type="button" disabled={!obsStatus.connected || pendingComponents.length > 0} onClick={onHideAllComponents}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/35 text-rose-200 text-xs font-bold disabled:opacity-40"
              title="Ocultar las gráficas de OBS sin cambiar la escena Program">
              <EyeOff className="w-4 h-4"/> Despejar gráficas
            </button>
          </div>
        </div>
      </div>

      {focusGraphicId && !focusExists && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
        <span>La gráfica seleccionada todavía no está publicada para En Vivo. Publica su diseño desde Diseñar antes de vincularla a OBS.</span>
        <button type="button" className="font-bold underline" onClick={()=>onEditGraphic(focusGraphicId)}>Volver a Diseñar</button>
      </div>}
      <div className="live-production-status" role="status">
        <div><span>CONEXIÓN OBS</span><strong>{obsStatus.connected?'Control disponible':'OBS desconectado'}</strong></div>
        <div><span>ESCENA EN PROGRAM</span><strong>{obsStatus.currentProgramScene||'Sin detectar'}</strong></div>
        <div><span>MODO ESTUDIO</span><strong>{obsStatus.studioMode?'Preview protegido':'Cambio directo de escenas'}</strong></div>
        <div><span>PROTECCIÓN</span><strong>{isProtectedMode?'Acciones directas protegidas':'Modo protegido desactivado'}</strong></div>
        <div><span>OPERACIONES</span><strong>{pendingComponents.length?`${pendingComponents.length} en curso`:'Sin operaciones pendientes'}</strong></div>
      </div>
      {/* Fast scene selection is accessible before the large status representations. */}
        {/* Scene selector — immediate access before the monitors */}
        <div className="p-4 md:p-5 glass-panel rounded-2xl border border-white/10 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Selector de Escenas OBS</h3>
              <span className="text-[11px] font-mono text-slate-400">{obsStatus.scenes.length} ESCENAS</span>
            </div>
            <p className={`text-xs mt-0.5 ${obsStatus.studioMode?'text-slate-400':'text-amber-200'}`}>
              {obsStatus.studioMode ? 'Seleccionar prepara en Preview; no cambia Program.' : isProtectedMode ? 'Modo Protegido activo: el selector no cambiará Program hasta desactivar la protección.' : 'Modo Estudio desactivado: seleccionar envía directamente a Program.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-1 max-h-[190px] overflow-y-auto pr-1">
            {obsStatus.scenes.length===0 && <div role="status" className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300">
              {obsStatus.connected ? 'OBS está conectado, pero no se han detectado escenas. Revisa la colección activa en OBS.' : 'Conecta OBS para cargar las escenas de realización.'}
            </div>}
            {obsStatus.scenes.map((scene) => {
              const isProgram = obsStatus.currentProgramScene === scene.name;
              const isPreview = obsStatus.currentPreviewScene === scene.name;

              return (
                <button
                  key={scene.id}
                  disabled={!obsStatus.connected || transitionPending || scenePending || (!obsStatus.studioMode && isProtectedMode)}
                  onClick={() => handleSceneSelect(scene.name)}
                  title={obsStatus.studioMode ? `Preparar «${scene.name}» en Preview sin cambiar Program` : isProtectedMode ? 'Modo Protegido impide cambiar Program directamente' : `Enviar «${scene.name}» directamente a Program (Modo Estudio desactivado)`}
                  aria-label={obsStatus.studioMode ? `Preparar escena ${scene.name} en Preview` : `Enviar escena ${scene.name} directamente a Program`}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isProgram
                      ? 'bg-rose-500/20 border-rose-500 text-white shadow-md'
                      : isPreview
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{scene.id.replace('scene-', '')}
                    </span>
                    <span className="text-xs font-bold truncate">{scene.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isProgram && (
                      <span className="px-2 py-0.5 rounded bg-rose-500 text-black text-[10px] font-extrabold uppercase">
                        PROGRAM
                      </span>
                    )}
                    {isPreview && !isProgram && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-extrabold uppercase">
                        PREVIEW
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>


      {/* DUAL MONITORS: PREVIEW & PROGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* PREVIEW MONITOR (GREEN TALLY) */}
        <div className="rounded-2xl glass-panel-elevated border-2 border-emerald-500/50 overflow-hidden shadow-2xl flex flex-col">
          {/* Monitor Top Bar */}
          <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${obsStatus.connected && obsStatus.studioMode?'bg-emerald-400':'bg-slate-500'}`} />
              <span className={`text-xs font-extrabold uppercase tracking-wider ${obsStatus.connected && obsStatus.studioMode?'text-emerald-300':'text-slate-300'}`}>
                PREVIEW (PREPARACIÓN)
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-0.5 rounded border border-white/10">
              {previewSceneLabel}
            </span>
          </div>

          {/* Monitor Screen Frame (16:9 Aspect Ratio) */}
          <div className={`relative bg-[#050608] monitor-grid flex items-center justify-center overflow-hidden ${compactDesk?'h-[130px] lg:h-[155px]':'aspect-video'}`}>
            {/* Screen Content Mock Representation */}
            <div className={`text-center z-10 ${compactDesk?'space-y-1 px-3 py-2':'space-y-2 p-6'}`}>
              <Tv className={`${compactDesk?'w-5 h-5':'w-10 h-10'} text-emerald-400/40 mx-auto`} />
              <div className="text-base font-bold text-white tracking-tight">
                {previewSceneLabel}
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {compactDesk?'Representación de estado · no muestra video': 'Escena en preparación. Representación esquemática (no es imagen real). Al confirmar la transición, OBS cambia su señal Program.'}
              </p>
            </div>

            {/* Corner Badge */}
            <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/80 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
              STANDBY
            </div>
          </div>

          {/* Preview Quick Action Footer */}
          <div className="p-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-slate-300">{obsStatus.connected && obsStatus.studioMode ? 'Escena indicada en Preview · no cambia Program' : 'Preview no disponible · revisa conexión y Modo Estudio'}</span>
            <span className="text-[11px] text-emerald-300 font-semibold">Transición debajo de Program ↓</span>
          </div>
        </div>

        {/* PROGRAM MONITOR (RED TALLY ON-AIR) */}
        <div className="rounded-2xl glass-panel-elevated border-2 border-rose-500 overflow-hidden shadow-2xl flex flex-col">
          {/* Monitor Top Bar */}
          <div className="px-4 py-2.5 bg-rose-950/40 border-b border-rose-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {obsStatus.connected && program && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-40" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${obsStatus.connected && program?'bg-rose-500':'bg-slate-500'}`} />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                PROGRAM (SALIDA OBS)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${obsStatus.connected && program?'bg-rose-500/20 text-rose-300 border-rose-500/40':'bg-white/5 text-slate-400 border-white/10'}`}>
                {obsStatus.connected && program ? 'PROGRAM OBS' : 'SIN DATOS'}
              </span>
              <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-0.5 rounded border border-white/10">
                {programSceneLabel}
              </span>
            </div>
          </div>

          {/* Monitor Screen Frame (16:9 Aspect Ratio) */}
          <div className={`relative bg-[#050608] monitor-grid flex items-center justify-center overflow-hidden ${compactDesk?'h-[130px] lg:h-[155px]':'aspect-video'}`}>
            {/* Screen Content Mock Representation */}
            <div className={`text-center z-10 ${compactDesk?'space-y-1 px-3 py-2':'space-y-2 p-6'}`}>
              <Tv className={`${compactDesk?'w-5 h-5':'w-10 h-10'} text-rose-500/60 mx-auto`} />
              <div className="text-base font-bold text-white tracking-tight">
                {programSceneLabel}
              </div>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                {compactDesk?'Representación de estado · confirmar en OBS': 'Vista esquemática de Program, no video real. Confirma la señal en el monitor de OBS.'}
              </p>
            </div>

            {/* Active Graphic Overlays Indicators on Program */}
            <div className={`absolute top-2 left-2 flex-wrap gap-1 ${compactDesk?'hidden':'flex max-w-[70%]'}`}>
              {visiblePublishedGraphics.map(c => (
                  <span key={c.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/80 text-rose-300 border border-rose-500/30">
                    ● {c.name}
                  </span>
                ))}
            </div>

            {/* Corner Badge */}
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 border border-rose-500/30 text-[10px] text-rose-400 font-mono font-bold">
              FORMATO NO VERIFICADO
            </div>
          </div>

          {/* Program Footer */}
          <div className="p-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-300">
            <span>{visiblePublishedGraphics.length} fuente{visiblePublishedGraphics.length===1?'':'s'} gráfica{visiblePublishedGraphics.length===1?'':'s'} habilitada{visiblePublishedGraphics.length===1?'':'s'} · verificar video en OBS</span>
            <span className={`font-semibold ${obsStatus.virtualCamActive?'text-sky-300':'text-slate-400'}`}>
              {obsStatus.virtualCamActive ? 'Cámara virtual OBS activa' : 'Cámara virtual OBS inactiva'}
            </span>
          </div>
        </div>
      </div>

      {/* OBS reports available transition names. Never send guessed presets. */}
      <section className="p-5 glass-panel rounded-2xl border border-white/10 space-y-3" aria-label="Transiciones OBS">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Transiciones de OBS</h3>
            <p className="text-xs text-slate-400">Solo se muestran las transiciones realmente instaladas. Un clic ejecuta una transición confirmada.</p>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{obsStatus.studioMode ? 'MODO ESTUDIO ACTIVO' : 'ACTIVA MODO ESTUDIO'}</span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={activeTransition}
            onChange={event => setSelectedTransition(event.target.value)}
            disabled={!obsStatus.connected || !availableTransitions.length || transitionPending}
            className="rounded-xl bg-slate-800 border border-white/20 text-white text-sm px-3 py-2 min-w-[180px] disabled:opacity-50"
            aria-label="Transición instalada en OBS"
          >
            {!availableTransitions.length && <option value="">Sin transiciones detectadas</option>}
            {availableTransitions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button
            disabled={!obsStatus.connected || !obsStatus.studioMode || transitionPending || scenePending || !activeTransition}
            onClick={() => onExecuteTransition(activeTransition)}
            className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >{transitionPending ? 'Transición en curso…' : `Enviar ${obsStatus.currentPreviewScene || 'Preview'} a Program · ${activeTransition || 'transición'}`}</button>
        </div>
        {!obsStatus.studioMode && <p className="text-amber-300 text-xs">Activa Modo Estudio antes de utilizar transiciones. Si lo desactivas, elegir una escena la envía directamente al aire.</p>}
        {obsStatus.studioMode && availableTransitions.length === 0 && <p className="text-amber-300 text-xs">No se recibió el catálogo de transiciones de OBS. Comprueba la conexión o vuelve a conectar.</p>}
        <div role="status" aria-live="polite" className="text-xs text-slate-300 border-t border-white/10 pt-2">{liveFeedback}</div>
      </section>

      {/* GRAPHICS SECTION: all broadcast controls remain below Preview / Program */}
      <div className="grid grid-cols-1 gap-6">
        {/* Published graphics — explicit OBS actions, full-width responsive controls */}
        <div className="p-4 md:p-5 glass-panel rounded-2xl border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Gráficas del programa ({componentLabels.length + Object.keys(customComponents).length} componentes)</h3>
              <p className="text-xs text-slate-400">Activa u oculta cada fuente gráfica en la escena Program de OBS. La tarjeta informativa no emite.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <button onClick={() => setEditLinks(!editLinks)} className="border border-white/20 rounded-lg px-2 py-1 hover:bg-white/10" aria-expanded={editLinks}>{editLinks ? 'Cerrar configuración de fuentes' : 'Configurar fuentes OBS'}</button>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> AL AIRE
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-600" /> OFF
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Buscar y filtrar gráficas">
            <label className="flex-1 min-w-[170px] max-w-sm">
              <span className="sr-only">Buscar gráfica por nombre</span>
              <input type="search" value={graphicSearch} onChange={e=>setGraphicSearch(e.target.value)}
                placeholder="Buscar una gráfica…" aria-label="Buscar una gráfica"
                className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B00]" />
            </label>
            <div role="group" aria-label="Filtrar gráficas por estado" className="flex items-center gap-1 rounded-lg border border-white/10 p-1 bg-black/20">
              {([
                ['all','Todas'],['visible','En Program'],['issues','Por revisar'],
              ] as const).map(([id,label])=>(
                <button type="button" key={id} aria-pressed={graphicFilter===id} onClick={()=>setGraphicFilter(id)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${graphicFilter===id?'bg-white/15 text-white':'text-slate-400 hover:text-white hover:bg-white/5'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="live-connection-summary" role="status" aria-live="polite">
            <span><strong>{report.verified}</strong> detectadas</span>
            <span><strong>{report.live}</strong> fuentes visibles</span>
            <span className={report.missing?'text-amber-300':''}><strong>{report.missing}</strong> sin vincular</span>
            {report.ambiguous>0&&<span className="text-rose-300"><strong>{report.ambiguous}</strong> ambiguas</span>}
            <span className="text-slate-400">Datos de fuentes OBS; video no verificado</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 pt-1">
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
                : 'OCULTO';
              return (
                <div key={c.type} ref={focusGraphicId===c.type?focusedGraphicRef:undefined}
                  className={`min-w-0 rounded-xl border bg-white/[0.02] p-2 flex flex-col gap-2 ${focusGraphicId===c.type?'border-orange-400/70 ring-1 ring-orange-400/40':'border-white/10'}`}>
                  <div className="flex flex-col gap-2 min-h-[86px] px-2 pt-2 pb-1" role="group" aria-label={`Estado de ${c.label}`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-base" aria-hidden="true">{c.icon}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${isLive?'bg-rose-500':unavailable?'bg-amber-400':'bg-slate-600'}`} aria-hidden="true"/>
                    </div>
                    <strong className="text-xs font-bold text-white leading-tight">{c.label}</strong>
                    {focusGraphicId===c.type && <span className="text-[10px] text-orange-300 font-semibold">Seleccionada desde Diseñar</span>}
                    <span role="status" className={`text-[10px] leading-snug ${isLive?'text-rose-300':unavailable?'text-amber-200':'text-slate-400'}`}>{status}</span>
                  </div>
                  <button type="button"
                    disabled={unavailable || pending || transitionPending || scenePending}
                    onClick={() => onToggleComponentVisibility(c.type, linked || source?.name)}
                    aria-label={`${pending?'Aplicando':isLive?'Ocultar de Program':'Mostrar en Program'}: ${c.label}`}
                    title={source ? `Fuente OBS: ${source.name} · Escena Program: ${obsStatus.currentProgramScene}` : 'No hay una fuente de navegador válida para esta gráfica en Program'}
                    className={`w-full min-h-9 rounded-lg px-2 py-2 text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLive?'bg-rose-500/15 border-rose-500/40 text-rose-100 hover:bg-rose-500/25':'bg-[#FF6B00] border-[#FF6B00] text-[#1A0A00] hover:bg-[#FF8B45]'}`}>
                    {pending?'Aplicando…':isLive?'Ocultar de Program':'Mostrar en Program'}
                  </button>
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
                  {config.instanceId && !linked && !source && obsStatus.connected && program && <button type="button" disabled={!!creatingSource} className="text-[10px] w-full mt-1 py-2 border border-orange-400/30 rounded-lg text-orange-200 bg-orange-400/10 hover:bg-orange-400/20 disabled:opacity-40"
                    onClick={async()=>{
                      if(!window.confirm(`¿Crear una fuente Browser Source para «${config.name}» en la escena «${program.name}»? La fuente quedará DESACTIVADA.`))return;
                      setCreatingSource(config.instanceId!);
                      try{const source=await onCreateCustomSource(config.instanceId!,program.name);changeLink(config.instanceId!,source);}
                      catch(err){window.alert(err instanceof Error?err.message:'No se pudo crear la fuente.');}
                      finally{setCreatingSource(null);}
                    }}>{creatingSource===config.instanceId?'Creando fuente…':'Crear fuente OBS'}</button>}
                  {editLinks && <select
                    aria-label={`Fuente OBS para ${c.label}`}
                    className="w-full mt-1 bg-slate-900 border border-white/20 rounded-lg text-[11px] p-2 text-white"
                    value={linked || ''}
                    onChange={event => changeLink(c.type, event.target.value)}
                    disabled={!program || pending}
                  >
                    <option value="">Detección automática por URL OBS</option>
                    {linked && !bindableSources.some(item => item.name === linked) && <option value={linked} disabled>Vínculo perdido: {linked}</option>}
                    {bindableSources.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>}
                </div>
              );
            })}
          </div>
          {displayedGraphics.length===0 && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-center text-xs text-slate-300">
            No hay gráficas que coincidan con el filtro actual. Prueba «Todas» o borra la búsqueda.
          </p>}
          {editLinks && <p className="text-xs text-amber-200">Si una gráfica aparece como «Fuente no vinculada», agrégala como fuente de navegador a la escena de OBS o selecciona su nombre exacto. Los vínculos se guardan localmente por escena.</p>}
        </div>
      </div>
    </div>
  );
};
