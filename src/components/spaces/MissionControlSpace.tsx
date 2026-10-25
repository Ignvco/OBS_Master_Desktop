import React, { useState } from 'react';
import { 
  EpisodeData, 
  OBSStatus, 
  OBSConnectionConfig,
  CountdownState,
  NavigationSpace,
  EditorialComponentConfig,
  ComponentType,
  CustomComponentRegistry
} from '../../types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Pause, 
  Clock, 
  Radio, 
  Video, 
  Mic, 
  Tv, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  RotateCcw,
  EyeOff,
  Flame,
  Layers,
  HelpCircle,
  Activity,
  Cpu,
  Settings2
} from 'lucide-react';
import { formatTime } from '../../utils/animationEngine';
import { PerformanceTab } from './PerformanceTab';
import { RecoveryCenter } from './RecoveryCenter';
import { DatabaseBackup } from 'lucide-react';
import { OBSSettingsTab } from './OBSSettingsTab';

interface MissionControlSpaceProps {
  episode: EpisodeData;
  obsStatus: OBSStatus;
  obsConfig: OBSConnectionConfig;
  countdown: CountdownState;
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents:CustomComponentRegistry;
  onNavigate: (space: NavigationSpace) => void;
  onStartCountdown: (seconds: number) => void;
  onPauseCountdown: () => void;
  onResetCountdown: () => void;
  onToggleComponentVisibility: (type: ComponentType) => void;
  onHideAllComponents: () => void;
  onSetProgramScene: (sceneName: string) => void;
  onToggleVirtualCam: () => void;
  onUpdateObsConfig: (config: Partial<OBSConnectionConfig>) => void;
  onConnectObs: (config?: Partial<OBSConnectionConfig>) => Promise<boolean>;
  onDisconnectObs: () => void;
  onShowToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) => void;
}

export const MissionControlSpace: React.FC<MissionControlSpaceProps> = ({
  episode,
  obsStatus,
  obsConfig,
  countdown,
  components,
  customComponents,
  onNavigate,
  onStartCountdown,
  onPauseCountdown,
  onResetCountdown,
  onToggleComponentVisibility,
  onHideAllComponents,
  onSetProgramScene,
  onToggleVirtualCam,
  onUpdateObsConfig,
  onConnectObs,
  onDisconnectObs,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'performance' | 'settings' | 'recovery'>('overview');
  const [showGuide, setShowGuide] = useState(() => {
    try { return localStorage.getItem('stdq-v42-ux-guide-dismissed-v1') !== '1'; }
    catch { return true; }
  });
  const toggleGuide = () => {
    const next = !showGuide;
    setShowGuide(next);
    try { localStorage.setItem('stdq-v42-ux-guide-dismissed-v1', next ? '0' : '1'); } catch {}
  };
  // Compute health score
  const activeComponentsCount = [...Object.values(components),...Object.values(customComponents)].filter(c => c.visibleInOBS).length;
  // OBS WebSocket and its virtual camera are not proof of a complete preflight or an external StreamYard broadcast.
  const isReady = obsStatus.virtualCamActive && obsStatus.connected;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4 max-w-[1640px] mx-auto w-full animate-in fade-in duration-150 select-none">
      {/* Subtab Selector — ATEM Utility Bank */}
      <div className="atem-module px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-[#06080b] border border-[#252b37] text-[10px] font-mono font-black text-sky-400 uppercase tracking-wider">
            STATION CTRL
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            Inicio · Estado Maestro de la Estación
          </span>
        </div>

        <div className="atem-well flex flex-wrap items-center gap-1">
          <button
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all ${
              subTab === 'overview'
                ? 'bg-[#232a38] text-white border border-sky-400/60 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Visión General</span>
          </button>

          <button
            onClick={() => setSubTab('performance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all ${
              subTab === 'performance'
                ? 'bg-[#232a38] text-white border border-sky-400/60 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Telemetría OBS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#06080b] text-sky-300 border border-[#252b37] font-bold">
              {obsStatus.cpuUsagePercent}%
            </span>
          </button>

          <button
            onClick={() => setSubTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all ${
              subTab === 'settings'
                ? 'bg-[#232a38] text-white border border-sky-400/60 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Configuración OBS</span>
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected ? 'bg-emerald-400 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`} />
          </button>

          <button
            onClick={() => setSubTab('recovery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all ${
              subTab === 'recovery'
                ? 'bg-[#232a38] text-white border border-sky-400/60 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DatabaseBackup className="w-3.5 h-3.5 text-emerald-400"/>
            <span>Recovery Center</span>
          </button>
        </div>
      </div>

      {subTab === 'performance' ? (
        <PerformanceTab obsStatus={obsStatus} onToggleVirtualCam={onToggleVirtualCam} />
      ) : subTab === 'recovery' ? (
        <RecoveryCenter obsStatus={obsStatus} />
      ) : subTab === 'settings' ? (
        <OBSSettingsTab
          obsStatus={obsStatus}
          obsConfig={obsConfig}
          onUpdateConfig={onUpdateObsConfig}
          onConnect={onConnectObs}
          onDisconnect={onDisconnectObs}
          onShowToast={onShowToast}
        />
      ) : (
        <div className="space-y-4">
          {/* Station Master Readout & Session Identity */}
          <section className="atem-module overflow-hidden">
            <div className="atem-module-header">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400 shadow-[0_0_6px_#22c55e]' : 'bg-amber-400'}`} />
                <span className="atem-label text-white">IDENTIDAD DE SESIÓN & ESTADO DE SALIDA</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{episode.date}</span>
            </div>

            <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#0d1016]">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-sky-950/60 text-sky-300 border border-sky-400/40">
                    EPISODIO #{episode.number}
                  </span>
                  <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                    {episode.title}
                  </h1>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {episode.subtitle}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
                  <span>CONDUCTOR: <strong className="text-white">{episode.hosts[0]?.name || 'Titular'}</strong></span>
                  <span>·</span>
                  <span>ESCALETA: <strong className="text-white">{episode.rundown.length} BLOQUES</strong></span>
                  <span>·</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> MOTOR V4.2 ACTIVO
                  </span>
                </div>
              </div>

              {/* Readiness Readout & Workspace Handoffs */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0 w-full lg:w-auto">
                <div className={`px-3.5 py-2 rounded border flex items-center gap-3 font-mono ${
                  isReady 
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isReady ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]' : 'bg-amber-400'}`} />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider">
                      {isReady ? 'OBS CONECTADO · CÁMARA VIRTUAL ACTIVA' : 'CONFIGURACIÓN DE EMISIÓN PENDIENTE'}
                    </div>
                    <div className="text-[10px] text-slate-300 font-sans">
                      {obsStatus.virtualCamActive ? 'Cámara de OBS activa · verifica la señal en StreamYard' : 'Conecta OBS y activa la cámara virtual antes de emitir'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('content-studio')}
                    className="atem-btn px-3.5 py-2 text-xs font-bold"
                  >
                    Ir a Diseñar
                  </button>
                  <button
                    onClick={() => onNavigate('preparacion')}
                    className="atem-btn px-3.5 py-2 text-xs font-bold"
                  >
                    Ver Escaleta / Preparar
                  </button>
                  <button
                    onClick={() => onNavigate('en-vivo')}
                    className="atem-btn atem-btn-pgm flex items-center gap-2 px-4 py-2 text-xs font-extrabold"
                  >
                    <span>Abrir Switcher En Vivo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Primary Telemetry Rack (4 Hardware Cells) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Cell 1: OBS Studio WebSocket */}
            <div className="atem-module p-3.5 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="atem-label">ENLACE OBS WEBSOCKET</span>
                <Radio className={`w-4 h-4 ${obsStatus.connected ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <div className="atem-readout px-3 py-2 flex items-center justify-between">
                <span className={`text-sm font-black ${obsStatus.connected ? 'text-emerald-400' : obsStatus.connecting ? 'text-amber-300' : 'text-red-400'}`}>
                  {obsStatus.connected ? 'CONECTADO' : obsStatus.connecting ? 'CONECTANDO...' : 'DESCONECTADO'}
                </span>
                <span className="text-[11px] text-slate-400">{obsStatus.connected ? `${obsStatus.latencyMs} ms` : '—'}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>PGM ACTUAL:</span>
                <span className="text-white truncate max-w-[140px] font-bold">
                  {obsStatus.currentProgramScene || '—'}
                </span>
              </div>
              <div className="pt-1.5 border-t border-[#1f2532]">
                <button
                  onClick={() => setSubTab('settings')}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <Settings2 className="w-3 h-3 text-amber-400" />
                  <span>Configurar WebSocket v5</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Cell 2: OBS Virtual Camera */}
            <div className="atem-module p-3.5 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="atem-label">CÁMARA VIRTUAL OBS</span>
                <Video className="w-4 h-4 text-sky-400" />
              </div>
              <div className="atem-readout px-3 py-2 flex items-center justify-between">
                <span className={`text-sm font-black ${obsStatus.virtualCamActive ? 'text-sky-400' : 'text-slate-400'}`}>
                  {obsStatus.virtualCamActive ? 'ACTIVA EN OBS' : 'INACTIVA'}
                </span>
                <button type="button"
                  disabled={!obsStatus.connected}
                  aria-pressed={obsStatus.virtualCamActive}
                  title={!obsStatus.connected?'Conecta OBS antes de utilizar la cámara virtual':obsStatus.virtualCamActive?'Detener cámara virtual de OBS':'Activar cámara virtual de OBS'}
                  onClick={onToggleVirtualCam}
                  className={`atem-btn text-[11px] px-2.5 py-1 font-bold ${
                    obsStatus.virtualCamActive ? 'border-sky-400 text-sky-200' : ''
                  }`}
                >
                  {obsStatus.virtualCamActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                Entrega señal DirectShow hacia StreamYard; no inicia una emisión pública por sí sola.
              </div>
            </div>

            {/* Cell 3: Audio Architecture */}
            <div className="atem-module p-3.5 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="atem-label">SUBSISTEMA DE AUDIO</span>
                <Mic className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="atem-readout px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-black text-slate-200">EXTERNO / INDEPENDIENTE</span>
                <span className="text-[10px] text-emerald-400 font-bold">BYPASS</span>
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                Esta estación controla exclusivamente video, escenas y gráficas en OBS Studio.
              </div>
            </div>

            {/* Cell 4: Active DSK Overlays Count */}
            <div className="atem-module p-3.5 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="atem-label">CAPAS DSK MARCADAS VISIBLES</span>
                <Layers className="w-4 h-4 text-red-400" />
              </div>
              <div className="atem-readout px-3 py-2 flex items-center justify-between">
                <div className="text-sm font-black text-white">
                  {activeComponentsCount} <span className="text-[11px] font-normal text-slate-400">/ {Object.values(components).length + Object.values(customComponents).length} CANALES</span>
                </div>
                {activeComponentsCount > 0 && (
                  <button
                    onClick={onHideAllComponents}
                    title="Despejar todas las gráficas"
                    className="atem-btn atem-btn-pgm text-[10px] px-2 py-0.5 font-bold"
                  >
                    Ocultar Todo
                  </button>
                )}
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                Estado registrado en estación · confirma siempre la salida en el monitor Program de OBS.
              </div>
            </div>
          </section>

          {/* Quick Broadcast Action Center + Countdown Module */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Left 2 Cols: Quick DSK Channel Triggers */}
            <div className="lg:col-span-2 atem-module flex flex-col justify-between">
              <div className="atem-module-header">
                <div className="flex items-center gap-2">
                  <Tv className="w-3.5 h-3.5 text-red-400" />
                  <h2 className="atem-label text-white">ACCIONES RÁPIDAS DE EMISIÓN (CANALES DSK PRINCIPALES)</h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {obsStatus.connected ? 'CONMUTACIÓN DIRECTA' : 'REQUIERE CONEXIÓN OBS'}
                </span>
              </div>

              <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {([
                    {
                      type: 'lower-third' as ComponentType,
                      code: 'DSK 01',
                      label: 'Lower Third',
                      primary: components['lower-third'].content.name,
                      secondary: components['lower-third'].content.role,
                    },
                    {
                      type: 'banner' as ComponentType,
                      code: 'DSK 02',
                      label: 'Banner de Frase',
                      primary: components['banner'].content.phrase,
                      secondary: 'Reflexión en pantalla',
                    },
                    {
                      type: 'question' as ComponentType,
                      code: 'DSK 03',
                      label: 'Pregunta Audiencia',
                      primary: components['question'].content.question,
                      secondary: 'Participación en vivo',
                    },
                    {
                      type: 'ticker' as ComponentType,
                      code: 'DSK 08',
                      label: 'Cintillo Ticker',
                      primary: components['ticker'].content.items[0],
                      secondary: 'Noticias & titulares en scroll',
                    },
                  ]).map((item) => {
                    const isLive = Boolean(components[item.type]?.visibleInOBS);
                    return (
                      <button
                        key={item.type}
                        type="button"
                        disabled={!obsStatus.connected}
                        onClick={() => onToggleComponentVisibility(item.type)}
                        className={`atem-btn p-3 text-left flex items-start justify-between gap-2 ${
                          isLive ? 'atem-btn-pgm' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-black/50 text-slate-300 border border-white/10">
                              {item.code}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                              {item.label}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white truncate">{item.primary}</div>
                          <div className="text-[10px] text-slate-400 truncate">{item.secondary}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-black shrink-0 ${
                          isLive ? 'bg-red-600 text-white' : 'bg-[#06080b] text-slate-400 border border-[#252b37]'
                        }`}>
                          {isLive ? 'ON AIR' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-[#1f2532] text-xs text-slate-400">
                  <span>Para diagnóstico de fuentes Browser o control de escenas, abre el switcher <strong>En Vivo</strong>.</span>
                  <button
                    onClick={() => onNavigate('content-studio')}
                    className="text-sky-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Editar en Diseñar</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Col: Broadcast Countdown Generator */}
            <div className="atem-module flex flex-col justify-between">
              <div className="atem-module-header">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <h2 className="atem-label text-white">CRONÓMETRO DE CUENTA REGRESIVA</h2>
                </div>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${countdown.isRunning ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40' : 'bg-[#06080b] text-slate-400 border border-[#252b37]'}`}>
                  {countdown.isRunning ? 'RUNNING' : 'STANDBY'}
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="atem-readout py-4 px-3 text-center">
                  <div className="text-4xl font-mono font-black text-white tracking-tight tabular-nums">
                    {formatTime(countdown.remainingSeconds)}
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mt-1">
                    {countdown.isRunning ? 'SINCRONIZADO CON PANTALLA DE ESPERA OBS' : 'PAUSADO · LISTO PARA DISPARO'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      [180, '03:00'],
                      [300, '05:00'],
                      [600, '10:00'],
                    ].map(([secs, label]) => (
                      <button
                        key={secs}
                        onClick={() => onStartCountdown(Number(secs))}
                        className="atem-btn py-1.5 text-xs font-mono font-bold text-slate-200"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {countdown.isRunning ? (
                      <button
                        onClick={onPauseCountdown}
                        className="atem-btn atem-btn-amber flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pausar Conteo</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartCountdown(countdown.remainingSeconds || 300)}
                        className="atem-btn atem-btn-pvw flex-1 py-2 text-xs font-extrabold flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Iniciar Conteo</span>
                      </button>
                    )}
                    <button
                      onClick={onResetCountdown}
                      title="Reiniciar cuenta regresiva"
                      className="atem-btn p-2 text-slate-300 hover:text-white"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Unified Broadcast Protocol & Workflow Orientation */}
          <section className="atem-module overflow-hidden" aria-label="Cómo empezar con OBS MASTER">
            <div className="atem-module-header">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <h2 className="atem-label text-white">PROTOCOLO OPERATIVO DE REALIZACIÓN BROADCAST</h2>
              </div>
              <button type="button" onClick={toggleGuide} aria-expanded={showGuide}
                className="atem-btn px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300">
                {showGuide ? 'Ocultar protocolo' : 'Mostrar protocolo'}
              </button>
            </div>

            {showGuide && (
              <div className="p-3.5 space-y-2.5 bg-[#0d1016]">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <button type="button" onClick={()=>onNavigate('content-studio')} className="atem-btn text-left p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-black text-sky-400 tracking-wider">FASE 01 · DISEÑO OFF-AIR</span>
                    <span className="block mt-1 text-xs font-extrabold text-white">Diseñar y Publicar Gráfica →</span>
                    <span className="block mt-1 text-[11px] text-slate-400">Edita el borrador y pulsa «Publicar diseño». Publicar no lo envía al aire.</span>
                  </button>
                  <button type="button" onClick={()=>onNavigate('preparacion')} className="atem-btn text-left p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-mono font-black text-emerald-400 tracking-wider">FASE 02 · PREFLIGHT & ESCALETA</span>
                    <span className="block mt-1 text-xs font-extrabold text-white">Verificar Señal y Bloques →</span>
                    <span className="block mt-1 text-[11px] text-slate-400">Audita escenas, fuentes Browser y carga bloques en Preview antes del vivo.</span>
                  </button>
                  <button type="button" onClick={()=>onNavigate('en-vivo')} className="atem-btn text-left p-3 flex flex-col justify-between border-red-500/40">
                    <span className="text-[10px] font-mono font-black text-red-400 tracking-wider">FASE 03 · SWITCHER EN VIVO</span>
                    <span className="block mt-1 text-xs font-extrabold text-white">Conmutar Program / DSK →</span>
                    <span className="block mt-1 text-[11px] text-slate-400">Ejecuta transiciones Preview → Program y activa gráficas publicadas.</span>
                  </button>
                </div>
                <p className="text-[11px] font-mono text-slate-400 atem-readout px-3 py-1.5">
                  NOTA DE SEGURIDAD: OBS conectado y cámara activa no confirman audio, imagen ni emisión pública. Comprueba esos puntos en OBS Studio y StreamYard antes de transmitir.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
