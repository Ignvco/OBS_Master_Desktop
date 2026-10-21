import React, { useState, useEffect } from 'react';
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
  directProgramRunning?: boolean;
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
  directProgramRunning = false,
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
  const [programMonitorError,setProgramMonitorError]=useState(false);
  const [previewMonitorError,setPreviewMonitorError]=useState(false);
  useEffect(()=>{setProgramMonitorError(false);setPreviewMonitorError(false);},[directProgramRunning]);
  const program = obsStatus.scenes.find(scene => scene.name === obsStatus.currentProgramScene);
  const programSources = program?.sources || [];
  const bindableSources = listBindableSources(programSources);
  const availableTransitions = obsStatus.availableTransitions || [];
  const report=liveBindingReport(programSources,[...Object.values(components),...Object.values(customComponents)],
    config=>config.instanceId?(config.obsSourceLinks?.[obsStatus.currentProgramScene]||''):(links[`${obsStatus.currentProgramScene}::${config.type}`]||''));
  const [showOnlyLinked,setShowOnlyLinked]=useState(false);

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
      <div className="flex items-center justify-between px-6 py-3.5 glass-panel rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {(obsStatus.connected||directProgramRunning)&&<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"/>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${obsStatus.connected||directProgramRunning?'bg-rose-600':'bg-slate-500'}`}></span>
            </span>
            <span className="text-xs font-extrabold uppercase tracking-widest text-white">
              Centro de Realización En Vivo
            </span>
          </div>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs text-slate-300">
            Episodio #{episode.number}: <strong className="text-white">{episode.title}</strong>
          </span>

          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold ${
            (obsStatus.connected||directProgramRunning)
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected||directProgramRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{directProgramRunning ? 'UNITY CAMERA ACTIVA' : obsStatus.connected ? `OBS CONECTADO (${obsStatus.latencyMs}ms)` : 'OBS DESCONECTADO'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          {/* Panic Clear All Overlays */}
          <button
            disabled={!obsStatus.connected || pendingComponents.length > 0}
            onClick={onHideAllComponents}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all"
            title="Ocultar inmediatamente todos los overlays gráficos en pantalla"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Pánico: Despejar Gráficas</span>
          </button>
        </div>
      </div>

      <div className="live-production-status" role="status">
        <div><span>SEÑAL</span><strong>{directProgramRunning?'Unity Camera activa':obsStatus.connected?'Control OBS conectado':'Fuera de conexión'}</strong></div>
        <div><span>ESCENARIO PROGRAM</span><strong>{obsStatus.currentProgramScene||'Sin detectar'}</strong></div>
        <div><span>MODO ESTUDIO</span><strong>{obsStatus.studioMode?'Preview protegido':'Cambio directo de escenas'}</strong></div>
        <div><span>OPERACIONES</span><strong>{pendingComponents.length?`${pendingComponents.length} en curso`:'Sin operaciones pendientes'}</strong></div>
      </div>
      {/* DUAL MONITORS: PREVIEW & PROGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PREVIEW MONITOR (GREEN TALLY) */}
        <div className="rounded-2xl glass-panel-elevated border-2 border-emerald-500/50 overflow-hidden shadow-2xl flex flex-col">
          {/* Monitor Top Bar */}
          <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                PREVIEW (PREPARACIÓN)
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-0.5 rounded border border-white/10">
              {obsStatus.currentPreviewScene}
            </span>
          </div>

          {/* Monitor Screen Frame (16:9 Aspect Ratio) */}
          <div className="relative aspect-video bg-[#050608] monitor-grid flex items-center justify-center overflow-hidden">
            {directProgramRunning && !previewMonitorError ? (
              <img src="/api/direct/preview.mjpg"
                className="absolute inset-0 w-full h-full object-contain"
                alt="Señal Preview independiente: cámara física y gráficas preparadas"
                onError={()=>setPreviewMonitorError(true)}
              />
            ) : (
              <div className="text-center space-y-2 p-6 z-10">
                <Tv className="w-10 h-10 text-emerald-400/40 mx-auto" />
                <div className="text-base font-bold text-white tracking-tight">
                  {directProgramRunning ? 'Monitor Preview temporalmente no disponible' : obsStatus.currentPreviewScene}
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {directProgramRunning ? 'Comprueba que el motor haya iniciado su captura de ensayo. Preview nunca altera Program.' : 'Sin Preview del motor: inicia Unity Camera desde la bandeja.'}
                </p>
                {directProgramRunning && previewMonitorError && (
                  <button type="button" className="text-xs underline text-emerald-300" onClick={()=>setPreviewMonitorError(false)}>
                    Reintentar Preview
                  </button>
                )}
              </div>
            )}

            {/* Corner Badge */}
            <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/80 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
              {directProgramRunning && !previewMonitorError ? 'PREVIEW REAL · ENSAYO AISLADO' : 'STANDBY'}
            </div>
          </div>

          {/* Preview Quick Action Footer */}
          <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-400">{directProgramRunning?'Composición de ensayo independiente · No enviada al aire':'Listo para enviar al aire'}</span>
            <button
              disabled={directProgramRunning || !obsStatus.connected || !obsStatus.studioMode || transitionPending || scenePending || !activeTransition}
              onClick={() => onExecuteTransition(activeTransition)}
              className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all"
            >
              <span>{directProgramRunning?'Take nativo pendiente':'Transición a Program'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PROGRAM MONITOR (RED TALLY ON-AIR) */}
        <div className="rounded-2xl glass-panel-elevated border-2 border-rose-500 overflow-hidden shadow-2xl flex flex-col">
          {/* Monitor Top Bar */}
          <div className="px-4 py-2.5 bg-rose-950/40 border-b border-rose-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                {directProgramRunning?'PROGRAM (UNITY CAMERA)':'PROGRAM (SALIDA OBS)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                {directProgramRunning?'SALIDA DIRECT':'SALIDA OBS'}
              </span>
              <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-0.5 rounded border border-white/10">
                {obsStatus.currentProgramScene}
              </span>
            </div>
          </div>

          {/* Monitor Screen Frame (16:9 Aspect Ratio) */}
          <div className="relative aspect-video bg-[#050608] monitor-grid flex items-center justify-center overflow-hidden">
            {directProgramRunning && !programMonitorError ? (
              <img src="/api/direct/program.mjpg"
                className="absolute inset-0 w-full h-full object-contain"
                alt="Señal de Program proveniente del motor Unity Camera"
                onError={()=>setProgramMonitorError(true)}
              />
            ) : (
              <div className="text-center space-y-2 p-6 z-10">
                <Tv className="w-10 h-10 text-rose-500/60 mx-auto animate-pulse" />
                <div className="text-base font-bold text-white tracking-tight">
                  {directProgramRunning
                    ? 'No se pudo abrir el monitor de Unity Camera. Confirma la señal en StreamYard.'
                    : 'Monitor de Program no disponible. Inicia Unity Camera desde la bandeja.'}
                </div>
                {directProgramRunning && programMonitorError && (
                  <button type="button" className="text-xs text-rose-200 underline" onClick={()=>setProgramMonitorError(false)}>
                    Reintentar monitor
                  </button>
                )}
              </div>
            )}

            {/* Active Graphic Overlays Indicators on Program */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1 max-w-[70%]">
              {[...Object.values(components),...Object.values(customComponents)]
                .filter(c => c.visibleInOBS && matchingLiveSources(programSources, c, c.type, linkedSource(c)).some(source => source.enabled && source.type === 'browser_source'))
                .map(c => (
                  <span key={c.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/80 text-rose-300 border border-rose-500/30">
                    ● {c.name}
                  </span>
                ))}
            </div>

            {/* Corner Badge */}
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 border border-rose-500/30 text-[10px] text-rose-400 font-mono font-bold">
              {directProgramRunning && !programMonitorError?'MONITOR REAL · 640×360':'MONITOR NO DISPONIBLE'}
            </div>
          </div>

          {/* Program Footer */}
          <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
            <span>{directProgramRunning?'Monitor del compositor Direct · Comprueba recepción en StreamYard':'Program · Sin señal Direct de monitoreo'}</span>
            <span className="font-semibold text-emerald-400">
              {directProgramRunning ? 'UNITY CAMERA: MOTOR ACTIVO' : obsStatus.virtualCamActive ? 'Cámara Virtual OBS: ACTIVA' : 'Cámara Virtual: OFF'}
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
          >{transitionPending ? 'Transición en curso…' : `Ejecutar ${activeTransition || 'transición'}`}</button>
        </div>
        {!obsStatus.studioMode && <p className="text-amber-300 text-xs">Activa Modo Estudio antes de utilizar transiciones. Si lo desactivas, elegir una escena la envía directamente al aire.</p>}
        {obsStatus.studioMode && availableTransitions.length === 0 && <p className="text-amber-300 text-xs">No se recibió el catálogo de transiciones de OBS. Comprueba la conexión o vuelve a conectar.</p>}
        <div role="status" aria-live="polite" className="text-xs text-slate-300 border-t border-white/10 pt-2">{liveFeedback}</div>
      </section>

      {/* LOWER SECTION: SCENE SWITCHER & LIVE GRAPHIC TALLY BUTTONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Scene Switcher Matrix */}
        <div className="lg:col-span-5 p-5 glass-panel rounded-2xl border border-white/10 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight">Selector de Escenas OBS</h3>
              <span className="text-[11px] font-mono text-slate-400">{obsStatus.scenes.length} ESCENAS</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Clic para preparar en Preview. En modo no-estudio conmuta directamente.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            {obsStatus.scenes.map((scene) => {
              const isProgram = obsStatus.currentProgramScene === scene.name;
              const isPreview = obsStatus.currentPreviewScene === scene.name;

              return (
                <button
                  key={scene.id}
                  disabled={!obsStatus.connected || transitionPending || scenePending}
                  onClick={() => handleSceneSelect(scene.name)}
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

        {/* Right 7 Cols: Quick Overlays Tally Pad (13 Graphics) */}
        <div className="lg:col-span-7 p-5 glass-panel rounded-2xl border border-white/10 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Gráficas del programa ({componentLabels.length + Object.keys(customComponents).length} componentes)</h3>
              <p className="text-xs text-slate-400">Detección automática por URL confirmada de OBS. Los vínculos manuales se verifican antes de activar una gráfica.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <button onClick={() => setEditLinks(!editLinks)} className="border border-white/20 rounded-lg px-2 py-1 hover:bg-white/10" aria-expanded={editLinks}>{editLinks ? 'Cerrar vínculos' : 'Vincular fuentes OBS'}</button>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> AL AIRE
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-600" /> OFF
              </span>
            </div>
          </div>

          <div className="live-connection-summary" role="status" aria-live="polite">
            <span><strong>{report.verified}</strong> detectadas</span>
            <span><strong>{report.live}</strong> fuentes visibles</span>
            <span className={report.missing?'text-amber-300':''}><strong>{report.missing}</strong> sin vincular</span>
            {report.ambiguous>0&&<span className="text-rose-300"><strong>{report.ambiguous}</strong> ambiguas</span>}
            <label><input type="checkbox" checked={showOnlyLinked} onChange={e=>setShowOnlyLinked(e.target.checked)}/> Solo detectadas</label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {[...componentLabels, ...Object.values(customComponents).map(config=>({type:config.instanceId!,label:config.name,icon:'✦'}))].map((c) => {
              const config = customComponents[c.type] || components[c.type as ComponentType];
              if (!config) return null;
              if(showOnlyLinked && matchingLiveSources(programSources,config,config.type,linkedSource(config)).length!==1)return null;
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
                <div key={c.type} className="min-w-0">
                  <button
                    type="button"
                    disabled={unavailable || pending || transitionPending || scenePending}
                    onClick={() => onToggleComponentVisibility(c.type, linked || source?.name)}
                    title={source ? `${source.name} · ${obsStatus.currentProgramScene}` : 'Vincula esta gráfica con una fuente de navegador de la escena Program'}
                    className={`w-full flex flex-col justify-between min-h-[100px] p-3 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isLive ? 'bg-rose-500/15 border-rose-500/50 text-white shadow-lg shadow-rose-500/15'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300'
                    }`}
                  >
                    <span className="flex justify-between items-center w-full"><span className="text-base" aria-hidden="true">{c.icon}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-rose-500' : unavailable ? 'bg-amber-400' : 'bg-slate-700'}`} /></span>
                    <span className="text-xs font-bold text-white leading-tight mt-2">{c.label}</span>
                    <span className="text-[10px] text-slate-400 mt-1">{status}</span>
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
          {editLinks && <p className="text-xs text-amber-200">Si una gráfica aparece como «Fuente no vinculada», agrégala como fuente de navegador a la escena de OBS o selecciona su nombre exacto. Los vínculos se guardan localmente por escena.</p>}
        </div>
      </div>
    </div>
  );
};
