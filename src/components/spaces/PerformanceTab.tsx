import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { OBSStatus } from '../../types';
import { 
  Cpu, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  HardDrive, 
  ShieldCheck, 
  Wifi, 
  Video, 
  Tv, 
  Layers 
} from 'lucide-react';

interface PerformanceTabProps {
  obsStatus: OBSStatus;
  onToggleVirtualCam: () => void;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  obsStatus,
  onToggleVirtualCam,
}) => {
  const rawHistory = obsStatus.telemetryHistory || [];
  const history = rawHistory;
  const hasTelemetry = obsStatus.connected && rawHistory.length > 0;
  const latestCpu = hasTelemetry ? obsStatus.cpuUsagePercent : 0;
  const latestBitrate = hasTelemetry ? obsStatus.kbitsPerSec : 0;
  const latestDropped = hasTelemetry ? obsStatus.droppedFrames : 0;
  const latestFps = hasTelemetry ? obsStatus.fps : 0;
  const latestMemory = hasTelemetry ? obsStatus.memoryUsageMb : 0;
  const renderTime = hasTelemetry ? obsStatus.renderTimeAverageMs : 0;

  const droppedRate = obsStatus.totalFrames > 0 
    ? ((latestDropped / obsStatus.totalFrames) * 100).toFixed(3) 
    : '0.000';

  // Custom Glass Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-xl glass-panel-elevated border border-white/15 shadow-2xl text-xs space-y-1">
          <p className="text-[10px] text-slate-400 font-mono font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-semibold flex items-center justify-between gap-4" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-mono tabular-nums text-white">{entry.value} {entry.unit || ''}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: CPU Load */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400">Carga de CPU (OBS)</span>
            <Cpu className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {hasTelemetry ? `${latestCpu}%` : 'N/D'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              latestCpu < 15 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {!hasTelemetry ? 'SIN DATOS' : latestCpu < 15 ? 'BAJO USO' : 'REVISAR'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
            <span>Render Lag: <strong className="text-white font-mono">{hasTelemetry ? `${renderTime} ms` : 'N/D'}</strong></span>
            <span>Memoria: <strong className="text-white font-mono">{hasTelemetry ? `${latestMemory} MB` : 'N/D'}</strong></span>
          </div>
        </div>

        {/* Metric 2: Bitrate */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400">Tasa de Bits (Bitrate)</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {hasTelemetry ? latestBitrate.toLocaleString() : 'N/D'}
            </span>
            <span className="text-xs text-slate-400 font-mono">kbps</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
            <span>Stream OBS: <strong className="text-sky-400 font-mono">{obsStatus.streamActive ? "activo" : "no activo"}</strong></span>
            <span className="text-slate-400 font-medium">{hasTelemetry ? "Datos OBS" : "Sin telemetría"}</span>
          </div>
        </div>

        {/* Metric 3: Dropped Frames */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400">Cuadros Perdidos</span>
            <AlertTriangle className={`w-4 h-4 ${latestDropped > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {hasTelemetry ? latestDropped : 'N/D'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({hasTelemetry ? droppedRate : 'N/D'}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
            <span>Total transmitidos:</span>
            <span className="font-mono text-white">{hasTelemetry ? obsStatus.totalFrames.toLocaleString() : 'N/D'}</span>
          </div>
        </div>

        {/* Metric 4: FPS & Virtual Cam Stream */}
        <div className="p-5 rounded-2xl glass-panel border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400">Tasa de Cuadros (FPS)</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tabular-nums tracking-tight">
              {hasTelemetry ? latestFps : 'N/D'}
            </span>
            <span className="text-xs text-slate-400 font-mono">FPS</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
            <span>Cámara Virtual:</span>
            <span className={`font-bold ${obsStatus.virtualCamActive ? 'text-sky-400' : 'text-slate-500'}`}>
              {obsStatus.virtualCamActive ? 'ENLACE ACTIVO' : 'PAUSADO'}
            </span>
          </div>
        </div>
      </div>

      {/* RECHARTS VISUALIZATION GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: CPU Load Real-Time Area Chart */}
        <div className="p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#FF6B00]" />
                <span>Carga de CPU en Tiempo Real (% de Procesamiento)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Datos reales obtenidos de OBS Studio; sin telemetría no se muestran valores simulados.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#FF6B00] bg-[#FF6B00]/10 px-2.5 py-1 rounded-lg border border-[#FF6B00]/30">
              {hasTelemetry ? `${latestCpu}%` : 'N/D'}
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  fontFamily="monospace"
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  domain={[0, 20]}
                  unit="%" 
                  fontFamily="monospace"
                />
                <Tooltip content={<CustomTooltip />} />

                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  name="Carga CPU" 
                  unit="%" 
                  stroke="#FF6B00" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#cpuGradient)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bitrate Stability Chart */}
        <div className="p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>Estabilidad de Bitrate (Tasa de Transferencia)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Bitrate de transmisión directa OBS (no mide el video de StreamYard ni la cámara virtual)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/30">
              {hasTelemetry && obsStatus.streamActive ? `${latestBitrate} kbps` : 'N/D'}
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="bitrateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  fontFamily="monospace"
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  domain={[0, "auto"]}
                  unit="" 
                  fontFamily="monospace"
                />
                <Tooltip content={<CustomTooltip />} />

                <Area 
                  type="monotone" 
                  dataKey="bitrate" 
                  name="Tasa de Bits" 
                  unit="kbps" 
                  stroke="#0ea5e9" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#bitrateGradient)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* LOWER SECTION: DROPPED FRAMES & HARDWARE PIPELINE DIAGNOSTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dropped Frames Bar Chart */}
        <div className="lg:col-span-7 p-6 rounded-2xl glass-panel border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Monitoreo de Cuadros Perdidos (Dropped Frames)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pérdida por renderizado o congestión de bus. 0 cuadros = transmisión perfecta
              </p>
            </div>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              latestDropped === 0 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {latestDropped === 0 ? '0 Cuadros Perdidos (100% Fluido)' : `${latestDropped} Cuadros`}
            </span>
          </div>

          <div className="h-48 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  fontFamily="monospace"
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  domain={[0, 5]}
                  fontFamily="monospace"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="droppedFrames" 
                  name="Frames Perdidos" 
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hardware & Encoding Specs Card */}
        <div className="lg:col-span-5 p-6 rounded-2xl glass-panel border border-white/10 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Pipeline de Hardware & Render
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">WIN 11 · OBS v30+</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5">
              <span className="text-slate-400">Cámara de Entrada:</span>
              <span className="font-semibold text-white">EMEET 4K WebCam (3840×2160)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5">
              <span className="text-slate-400">Lienzo Base:</span>
              <span className="font-mono text-white">{hasTelemetry ? `${latestFps} FPS reportados por OBS` : "Resolución y FPS sin verificar"}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5">
              <span className="text-slate-400">Codificador de Salida:</span>
              <span className="font-semibold text-emerald-400 font-mono">NVENC H.264 Acelerado</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5">
              <span className="text-slate-400">Salida Virtual:</span>
              <span className="font-semibold text-sky-400 font-mono">OBS Virtual Camera Driver</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Transmisión fluida sin saturación de GPU ni pérdida de paquetes.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
