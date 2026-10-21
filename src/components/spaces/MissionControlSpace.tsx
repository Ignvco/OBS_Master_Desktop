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
  // Compute health score
  const activeComponentsCount = [...Object.values(components),...Object.values(customComponents)].filter(c => c.visibleInOBS).length;
  const isReady = obsStatus.virtualCamActive && obsStatus.connected;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-200">
      {/* Subtab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">Espacio A</span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-300 font-semibold">Misión Control</span>
        </div>

        <div className="flex flex-wrap items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 gap-1">
          <button
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'overview'
                ? 'bg-white/15 text-white border border-white/10 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Visión General</span>
          </button>

          <button
            onClick={() => setSubTab('performance')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'performance'
                ? 'bg-white/15 text-white border border-white/10 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Rendimiento OBS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
              {obsStatus.cpuUsagePercent}%
            </span>
          </button>

          <button
            onClick={() => setSubTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === 'settings'
                ? 'bg-white/15 text-white border border-white/10 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Ajustes OBS (WebSocket)</span>
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          </button>
          <button onClick={() => setSubTab('recovery')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${subTab === 'recovery' ? 'bg-white/15 text-white border border-white/10' : 'text-slate-400 hover:text-white'}`}>
            <DatabaseBackup className="w-3.5 h-3.5 text-[#FF6B00]"/> Recovery Center
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
        <div className="space-y-8">
      {/* Hero Welcome & Broadcast Readiness Banner */}
      <section className="relative overflow-hidden rounded-3xl p-8 glass-panel border border-white/10 bg-gradient-to-br from-[#1A1D24] via-[#12141A] to-[#0A0B0E] shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-8 bottom-8 opacity-10 pointer-events-none hidden md:block">
          <svg viewBox="0 0 100 100" className="w-48 h-48 text-[#FF6B00] fill-current">
            <path d="M45 15 L55 15 L55 35 C55 40 65 50 65 65 A20 20 0 1 1 25 65 C25 50 35 40 35 35 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30">
                Centro de Operaciones · Misión Control
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {episode.date}
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Episodio #{episode.number}: <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#FF6B00]">{episode.title}</span>
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              {episode.subtitle}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span>Conductor: <strong className="text-white">{episode.hosts[0]?.name || 'Samuel Zamorano'}</strong></span>
              <span aria-hidden="true">·</span>
              <span>{episode.rundown.length} bloques planificados</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Estación V3.0 Optimizada
              </span>
            </div>
          </div>

          {/* Readiness Meter & Direct Action */}
          <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
            <div className={`px-4 py-3 rounded-2xl border flex items-center gap-3 backdrop-blur-md ${
              isReady 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {isReady ? 'Sistema Listo Para Salir Al Aire' : 'Revisión Pre-Vuelo Requerida'}
                </div>
                <div className="text-[11px] opacity-80">
                  {obsStatus.virtualCamActive ? 'Cámara Virtual activa hacia StreamYard' : 'Activar Cámara Virtual antes de transmitir'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('preparacion')}
                className="px-4 py-2.5 text-xs font-semibold text-slate-200 hover:text-white glass-panel hover:bg-white/10 rounded-xl transition-all"
              >
                Ver Escaleta
              </button>
              <button
                onClick={() => onNavigate('en-vivo')}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#ff7a1a] rounded-xl shadow-lg shadow-[#FF6B00]/25 transition-all"
              >
                <span>Ir al Control En Vivo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Telemetry Grid (4 Essential Checks) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: OBS Studio State */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">OBS Studio</span>
            <Radio className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {obsStatus.connected ? 'Conectado Live' : obsStatus.connecting ? 'Conectando...' : 'Desconectado'}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
            <span>Escena al Aire:</span>
            <span className="font-mono text-white text-[11px] truncate max-w-[140px] font-semibold">
              {obsStatus.currentProgramScene}
            </span>
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => setSubTab('settings')}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Settings2 className="w-3 h-3 text-amber-400" />
              <span>Ajustes & Handshake OBS</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: OBS Virtual Camera */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Cámara Virtual</span>
            <Video className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-white tracking-tight">
              {obsStatus.virtualCamActive ? 'Emisión Activa' : 'Inactiva'}
            </span>
            <button
              onClick={onToggleVirtualCam}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${
                obsStatus.virtualCamActive
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {obsStatus.virtualCamActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
          <div className="text-xs text-slate-400 pt-1">
            Alimenta StreamYard en navegador Windows
          </div>
        </div>

        {/* Card 3: Audio Master (Mac) */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Audio Master (Mac)</span>
            <Mic className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            Independiente
          </div>
          <div className="text-xs text-slate-400 pt-1 leading-tight">
            Microfonía & mezcla gestionadas externamente en Mac.
          </div>
        </div>

        {/* Card 4: Active Overlays Count */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Gráficas al Aire</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-white tracking-tight">
              {activeComponentsCount} <span className="text-xs font-normal text-slate-400">de 13 activos</span>
            </div>
            {activeComponentsCount > 0 && (
              <button
                onClick={onHideAllComponents}
                title="Pánico: Ocultar todas las gráficas"
                className="text-[11px] px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-semibold"
              >
                Ocultar Todo
              </button>
            )}
          </div>
          <div className="text-xs text-slate-400 pt-1">
            Browser Sources en OBS Studio
          </div>
        </div>
      </section>

      {/* Quick Broadcast Action Center */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Quick Action Triggers */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel border border-white/5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Acciones Rápidas de Emisión</h2>
              <p className="text-xs text-slate-400">Disparadores inmediatos para la producción en directo</p>
            </div>
            <span className="text-xs font-semibold text-slate-400 font-mono">1-CLICK EXEC</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Quick 1: Lower Third Toggle */}
            <button
              onClick={() => onToggleComponentVisibility('lower-third')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                components['lower-third'].visibleInOBS
                  ? 'bg-rose-500/15 border-rose-500/40 text-white'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Lower Third</div>
                <div className="text-sm font-semibold mt-0.5">{components['lower-third'].content.name}</div>
                <div className="text-[11px] text-slate-400">{components['lower-third'].content.role}</div>
              </div>
              <div className={`w-3 h-3 rounded-full mt-1 ${components['lower-third'].visibleInOBS ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
            </button>

            {/* Quick 2: Banner Frase */}
            <button
              onClick={() => onToggleComponentVisibility('banner')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                components['banner'].visibleInOBS
                  ? 'bg-rose-500/15 border-rose-500/40 text-white'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Banner de Frase</div>
                <div className="text-sm font-semibold mt-0.5 truncate">{components['banner'].content.phrase}</div>
                <div className="text-[11px] text-slate-400">Reflexión en pantalla</div>
              </div>
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${components['banner'].visibleInOBS ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
            </button>

            {/* Quick 3: Pregunta Tu Turno */}
            <button
              onClick={() => onToggleComponentVisibility('question')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                components['question'].visibleInOBS
                  ? 'bg-rose-500/15 border-rose-500/40 text-white'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Pregunta Audiencia</div>
                <div className="text-sm font-semibold mt-0.5 truncate">{components['question'].content.question}</div>
                <div className="text-[11px] text-slate-400">Tu Turno / Participación</div>
              </div>
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${components['question'].visibleInOBS ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
            </button>

            {/* Quick 4: Ticker Cintillo */}
            <button
              onClick={() => onToggleComponentVisibility('ticker')}
              className={`p-4 rounded-xl border text-left transition-all flex items-start justify-between ${
                components['ticker'].visibleInOBS
                  ? 'bg-rose-500/15 border-rose-500/40 text-white'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Cintillo Ticker</div>
                <div className="text-sm font-semibold mt-0.5 truncate">{components['ticker'].content.items[0]}</div>
                <div className="text-[11px] text-slate-400">Noticias & WhatsApp en scroll</div>
              </div>
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${components['ticker'].visibleInOBS ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-white/5 text-xs text-slate-400">
            <span>Para personalizar textos y estilos ingresa a <strong>Content Studio</strong>.</span>
            <button
              onClick={() => onNavigate('content-studio')}
              className="text-[#FF6B00] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Abrir Diseñador</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Col: Countdown Widget */}
        <div className="p-6 rounded-2xl glass-panel border border-white/5 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">Cuenta Regresiva</h2>
              <Clock className="w-4 h-4 text-[#FF6B00]" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Sincronizada con pantalla de espera OBS</p>
          </div>

          <div className="my-auto py-4 text-center">
            <div className="text-5xl font-mono font-extrabold text-white tracking-tight tabular-nums">
              {formatTime(countdown.remainingSeconds)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {countdown.isRunning ? 'Temporizador activo en vivo' : 'En pausa / Listo para iniciar'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onStartCountdown(180)}
                className="py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
              >
                3 Min
              </button>
              <button
                onClick={() => onStartCountdown(300)}
                className="py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
              >
                5 Min
              </button>
              <button
                onClick={() => onStartCountdown(600)}
                className="py-1.5 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
              >
                10 Min
              </button>
            </div>

            <div className="flex items-center gap-2">
              {countdown.isRunning ? (
                <button
                  onClick={onPauseCountdown}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              ) : (
                <button
                  onClick={() => onStartCountdown(countdown.remainingSeconds || 300)}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] text-white hover:bg-[#ff7a1a] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-[#FF6B00]/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar Conteo</span>
                </button>
              )}
              <button
                onClick={onResetCountdown}
                title="Reiniciar a 5 minutos"
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Broadcast Workflow Guidance Card */}
      <section className="p-6 rounded-2xl glass-panel border border-white/5 space-y-4">
        <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-[#FF6B00]" />
          <span>Flujo de Trabajo Operativo del Programa</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
            <div className="font-bold text-[#FF6B00]">Paso 1: Pre-Vuelo</div>
            <p className="text-slate-400 leading-relaxed">
              Verifica en <strong>Preparación</strong> que la cámara EMEET 4K y la cámara virtual estén listas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
            <div className="font-bold text-[#FF6B00]">Paso 2: Escaleta</div>
            <p className="text-slate-400 leading-relaxed">
              Revisa los 8 bloques y presiona <strong>Cargar en Preview</strong> para preparar escenas sin salir al aire.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
            <div className="font-bold text-[#FF6B00]">Paso 3: Realización</div>
            <p className="text-slate-400 leading-relaxed">
              En <strong>En Vivo</strong> ejecuta cortes y transiciones con monitores Preview/Program protegidos.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
            <div className="font-bold text-[#FF6B00]">Paso 4: StreamYard</div>
            <p className="text-slate-400 leading-relaxed">
              En StreamYard confirma la señal de OBS Virtual Camera y presiona "Transmitir en Vivo".
            </p>
          </div>
        </div>
      </section>
        </div>
      )}
    </div>
  );
};
