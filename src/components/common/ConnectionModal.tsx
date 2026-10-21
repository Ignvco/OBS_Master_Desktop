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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl glass-panel-elevated rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
              status.connected
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-[#FF6B00]/15 border-[#FF6B00]/30 text-[#FF6B00]'
            }`}>
              <Radio className={`w-5 h-5 ${status.connecting ? 'animate-spin' : status.connected ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Conexión en Vivo a OBS Studio
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  status.connected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : status.connecting
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {status.connected ? 'CONECTADO EN VIVO' : status.connecting ? 'CONECTANDO...' : 'DESCONECTADO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Protocolo OBS WebSocket v5 (Puerto estándar 4455)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Connection Parameters Form */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Parámetros de Servidor OBS</span>
              </span>
              <span className="text-[11px] font-mono text-[#FF6B00]">
                {computedUrl}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Dirección IP / Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="127.0.0.1 (local)"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Puerto WebSocket</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="4455"
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-sm text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Contraseña de Autenticación</span>
                <span className="text-slate-500 font-normal">Dejar vacío si no tiene contraseña en OBS</span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña configurada en OBS Studio..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl glass-input text-sm text-white font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-white/5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoConnect}
                  onChange={(e) => setAutoConnect(e.target.checked)}
                  className="accent-[#FF6B00] rounded"
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
                  className="accent-sky-500 rounded"
                />
                <span className="text-xs text-slate-300 font-mono">
                  Usar SSL (wss://)
                </span>
              </label>
            </div>

            {isHttps && !useSsl && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                <strong>Aviso de seguridad del navegador:</strong> Al estar cargando esta app en HTTPS, Google Chrome/Firefox pueden bloquear conexiones a <code>ws://127.0.0.1</code> por política de contenido mixto.
                <br />
                <strong>Solución rápida:</strong> Abre la app localmente en <code>http://localhost:3000</code> o en la barra de URL haz clic en Configuración del sitio y permite <em>Contenido no seguro</em>.
              </div>
            )}
          </div>

          {/* Connected OBS Telemetry & Scenes Inspection */}
          {status.connected && (
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <Check className="w-4 h-4" />
                  <span>OBS Studio Sincronizado en Vivo</span>
                </div>
                <button
                  onClick={handleSyncScenes}
                  className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sincronizar Escenas</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Latencia</span>
                  <span className="text-sm font-bold text-white font-mono">{status.latencyMs} ms</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Carga CPU</span>
                  <span className="text-sm font-bold text-white font-mono">{status.cpuUsagePercent}%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">FPS</span>
                  <span className="text-sm font-bold text-white font-mono">{status.fps}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Cámara Virtual</span>
                  <span className={`text-sm font-bold font-mono ${status.virtualCamActive ? 'text-sky-400' : 'text-slate-400'}`}>
                    {status.virtualCamActive ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 pt-1">
                Escenas detectadas en OBS ({status.scenes.length}):{' '}
                <strong className="text-white">
                  {status.scenes.map(s => s.name).join(', ')}
                </strong>
              </div>
            </div>
          )}

          {/* Live Diagnostic Logs Console */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Consola de Diagnóstico & Eventos OBS</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Últimos {logs.length} eventos</span>
            </div>

            <div className="h-40 p-3 rounded-xl bg-black/80 border border-white/10 font-mono text-[11px] overflow-y-auto space-y-1.5">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">No hay registros aún...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`font-semibold shrink-0 uppercase text-[9px] px-1 py-0.2 rounded ${
                      log.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                      log.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
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
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-slate-300 space-y-1">
            <span className="font-bold text-sky-400 block">Flujo de Emisión en Vivo:</span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. OBS Studio recibe la cámara EMEET 4K y las gráficas HTML de esta estación.
              2. Al presionar <strong>Cámara Virtual</strong> en OBS Master, la señal se envía a Windows DirectShow.
              3. En StreamYard seleccionas <strong>OBS Virtual Camera</strong> y transmites hacia YouTube/Facebook.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02] shrink-0">
          <div>
            {status.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 rounded-xl hover:bg-rose-500/10 transition-colors"
              >
                Desconectar de OBS
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-mono">
                Puerto por defecto en OBS Studio: 4455
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={isTesting}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#ff7a1a] rounded-xl shadow-lg shadow-[#FF6B00]/25 transition-all disabled:opacity-50"
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
