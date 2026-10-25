import React, { useState, useEffect } from 'react';
import { 
  X, 
  Radio, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  ShieldCheck, 
  Video, 
  Layers, 
  Terminal, 
  Wifi, 
  WifiOff, 
  Key,
  ExternalLink
} from 'lucide-react';
import { obsService } from '../../services/obsWebSocket';
import { OBSStatus, OBSConnectionConfig } from '../../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: OBSStatus;
  config: OBSConnectionConfig;
  onConnect: (config: OBSConnectionConfig) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  status,
  config,
  onConnect,
}) => {
  const [host, setHost] = useState(config.host || '127.0.0.1');
  const [port, setPort] = useState(config.port || 4455);
  const [password, setPassword] = useState(config.password || '');
  const [autoConnect, setAutoConnect] = useState(config.autoConnect ?? true);
  const [useSsl, setUseSsl] = useState(config.useSsl ?? false);
  const [isTesting, setIsTesting] = useState(false);
  const [logs, setLogs] = useState(obsService.logs);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const computedUrl = (host.startsWith('ws://') || host.startsWith('wss://'))
    ? host
    : `${useSsl ? 'wss' : 'ws'}://${host.trim() || '127.0.0.1'}:${port || 4455}`;

  useEffect(() => {
    const unsubscribe = obsService.subscribeLogs(() => {
      setLogs([...obsService.logs]);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSaveAndConnect = async () => {
    setIsTesting(true);
    const newConfig: OBSConnectionConfig = {
      host: host.trim() || '127.0.0.1',
      port: Number(port) || 4455,
      password: password.trim(),
      autoConnect,
      useSsl,
    };
    await onConnect(newConfig);
    setIsTesting(false);
  };

  const handleDisconnect = () => {
    obsService.disconnect();
  };

  const handleSyncScenes = async () => {
    await obsService.syncWithOBS();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl atem-module border border-[#2e3646] shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="atem-module-header px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded flex items-center justify-center border transition-colors ${
              status.connected
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400'
                : 'bg-[#07090c] border-[#2e3646] text-sky-400'
            }`}>
              <Radio className={`w-4 h-4 ${status.connecting ? 'animate-spin' : status.connected ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Conexión en Vivo a OBS Studio
                </h3>
                <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                  status.connected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : status.connecting
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}>
                  {status.connected ? 'CONECTADO EN VIVO' : status.connecting ? 'CONECTANDO...' : 'DESCONECTADO'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                OBS WEBSOCKET V5 · PUERTO ESTÁNDAR 4455
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="atem-btn p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-[#0d1015]">
          {/* Connection Parameters Form */}
          <div className="p-4 rounded bg-[#11141a] border border-[#252b37] space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#1f2530] pb-2">
              <span className="atem-label flex items-center gap-2 text-slate-200">
                <Wifi className="w-3.5 h-3.5 text-sky-400" />
                <span>Parámetros de Servidor OBS</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#06080b] border border-[#222834] text-sky-400">
                {computedUrl}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dirección IP / Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="127.0.0.1 (local)"
                  className="w-full px-3 py-2 rounded glass-input text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Puerto WebSocket</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="4455"
                  className="w-full px-3 py-2 rounded glass-input text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Contraseña de Autenticación</span>
                <span className="text-slate-500 font-normal normal-case">Vacío si OBS no exige clave</span>
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña configurada en OBS Studio..."
                  className="w-full pl-9 pr-3 py-2 rounded glass-input text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[#1f2530]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConnect}
                  onChange={(e) => setAutoConnect(e.target.checked)}
                  className="accent-sky-400 rounded"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Conectar automáticamente al iniciar la estación
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSsl}
                  onChange={(e) => setUseSsl(e.target.checked)}
                  className="accent-sky-400 rounded"
                />
                <span className="text-xs text-slate-300 font-mono">
                  Usar SSL (wss://)
                </span>
              </label>
            </div>

            {isHttps && !useSsl && (
              <div className="p-3 rounded bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 leading-relaxed">
                <strong>Aviso de seguridad del navegador:</strong> Al estar cargando esta app en HTTPS, el navegador puede bloquear conexiones a <code>ws://127.0.0.1</code>. Usa la app local o habilita contenido local.
              </div>
            )}
          </div>

          {/* Connected OBS Telemetry & Scenes Inspection */}
          {status.connected && (
            <div className="p-3.5 rounded bg-emerald-950/20 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Check className="w-4 h-4" />
                  <span>OBS Studio Sincronizado en Vivo</span>
                </div>
                <button
                  onClick={handleSyncScenes}
                  className="atem-btn text-[11px] font-bold text-white px-2.5 py-1 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>Sincronizar Escenas</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 atem-readout">
                  <span className="text-[9px] uppercase text-slate-500 block">Latencia</span>
                  <span className="text-sm font-bold text-white">{status.latencyMs} ms</span>
                </div>
                <div className="p-2 atem-readout">
                  <span className="text-[9px] uppercase text-slate-500 block">Carga CPU</span>
                  <span className="text-sm font-bold text-white">{status.cpuUsagePercent}%</span>
                </div>
                <div className="p-2 atem-readout">
                  <span className="text-[9px] uppercase text-slate-500 block">FPS</span>
                  <span className="text-sm font-bold text-white">{status.fps}</span>
                </div>
                <div className="p-2 atem-readout">
                  <span className="text-[9px] uppercase text-slate-500 block">Cámara Virtual</span>
                  <span className={`text-sm font-bold ${status.virtualCamActive ? 'text-sky-400' : 'text-slate-400'}`}>
                    {status.virtualCamActive ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 pt-1 font-mono">
                ESCENAS ({status.scenes.length}):{' '}
                <strong className="text-white">
                  {status.scenes.map(s => s.name).join(' · ')}
                </strong>
              </div>
            </div>
          )}

          {/* Live Diagnostic Logs Console */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="atem-label flex items-center gap-2 text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Consola de Diagnóstico & Eventos OBS</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Últimos {logs.length} eventos</span>
            </div>

            <div className="h-36 p-3 atem-readout text-[11px] overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">No hay registros aún...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`font-bold shrink-0 uppercase text-[9px] px-1 py-0.2 rounded ${
                      log.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                      log.type === 'error' ? 'bg-red-500/20 text-red-400' :
                      log.type === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-sky-500/20 text-sky-400'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* StreamYard Architecture Reminder */}
          <div className="p-3 rounded bg-[#11141a] border border-[#252b37] text-xs text-slate-300 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 block">Cadena de Señal Broadcast (OBS ➔ StreamYard):</span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. OBS Studio compone las cámaras y las Browser Sources locales de esta estación.
              2. El interruptor <strong>Cámara OBS</strong> entrega la señal de video por DirectShow.
              3. En StreamYard se selecciona <strong>OBS Virtual Camera</strong> para la emisión externa.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#252b37] bg-[#141820] shrink-0">
          <div>
            {status.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="atem-btn px-3 py-1.5 text-xs font-bold text-red-300 border-red-500/40 hover:border-red-400"
              >
                Desconectar de OBS
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-mono">
                Puerto por defecto en OBS Studio: 4455
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="atem-btn px-4 py-1.5 text-xs font-bold"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={isTesting}
              className="atem-btn atem-btn-pvw flex items-center gap-2 px-4 py-1.5 text-xs font-extrabold disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{status.connected ? 'Reconectar / Actualizar' : 'Conectar a OBS Studio'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
