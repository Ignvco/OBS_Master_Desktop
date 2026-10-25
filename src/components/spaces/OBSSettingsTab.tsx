import React, { useState, useEffect, useRef } from 'react';
import { OBSStatus, OBSConnectionConfig } from '../../types';
import { obsService, OBSLogEntry } from '../../services/obsWebSocket';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  KeyRound, 
  Lock, 
  Unlock, 
  Copy, 
  Check, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  ShieldAlert, 
  Terminal, 
  Eye, 
  EyeOff, 
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  ExternalLink,
  Power,
  Layers,
  Radio,
  Zap,
  Download
} from 'lucide-react';

interface OBSSettingsTabProps {
  obsStatus: OBSStatus;
  obsConfig: OBSConnectionConfig;
  onUpdateConfig: (config: Partial<OBSConnectionConfig>) => void;
  onConnect: (config?: Partial<OBSConnectionConfig>) => Promise<boolean>;
  onDisconnect: () => void;
  onShowToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) => void;
}

export const OBSSettingsTab: React.FC<OBSSettingsTabProps> = ({
  obsStatus,
  obsConfig,
  onUpdateConfig,
  onConnect,
  onDisconnect,
  onShowToast,
}) => {
  // Local form state
  const [host, setHost] = useState(obsConfig.host || '127.0.0.1');
  const [port, setPort] = useState(obsConfig.port || 4455);
  const [password, setPassword] = useState(obsConfig.password || '');
  const [useSsl, setUseSsl] = useState(obsConfig.useSsl || false);
  const [autoConnect, setAutoConnect] = useState(obsConfig.autoConnect ?? true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Live handshake logs & log filtering
  const [logs, setLogs] = useState<OBSLogEntry[]>(() => obsService.getLogs());
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warn' | 'error'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync state if external obsConfig changes
  useEffect(() => {
    setHost(obsConfig.host || '127.0.0.1');
    setPort(obsConfig.port || 4455);
    setPassword(obsConfig.password || '');
    setUseSsl(obsConfig.useSsl || false);
    setAutoConnect(obsConfig.autoConnect ?? true);
  }, [obsConfig]);

  // Subscribe to live log events from OBS WebSocket
  useEffect(() => {
    const unsubscribe = obsService.subscribeLogs((newLog) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 79)]);
    });
    return () => unsubscribe();
  }, []);

  // Compute live target WebSocket URL preview
  const rawHost = (host || '127.0.0.1').trim();
  const protocol = useSsl ? 'wss' : 'ws';
  const computedUrl = rawHost.startsWith('ws://') || rawHost.startsWith('wss://')
    ? rawHost
    : `${protocol}://${rawHost}:${port}`;

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Copy helper
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(computedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    onShowToast('info', 'URL Copiada', computedUrl);
  };

  // Save current config
  const handleSaveConfig = () => {
    const updated: OBSConnectionConfig = {
      host: host.trim(),
      port: Number(port) || 4455,
      password: password,
      useSsl: Boolean(useSsl),
      autoConnect: Boolean(autoConnect),
    };
    onUpdateConfig(updated);
    obsService.updateConfig(updated);
    onShowToast('success', 'Configuración de OBS Guardada', `Destino: ${computedUrl}`);
  };

  // Connect & Trigger Handshake test
  const handleTestConnection = async () => {
    setIsTesting(true);
    const updated: OBSConnectionConfig = {
      host: host.trim(),
      port: Number(port) || 4455,
      password: password,
      useSsl: Boolean(useSsl),
      autoConnect: Boolean(autoConnect),
    };
    onUpdateConfig(updated);
    onShowToast('info', 'Iniciando Handshake OBS...', `Contactando ${computedUrl}`);
    const success = await onConnect(updated);
    setIsTesting(false);
    if (success) {
      onShowToast('success', 'Handshake OBS Exitoso', 'Conexión verificada con OBS Studio.');
    } else {
      onShowToast('warning', 'Handshake Fallido', 'Revisa que OBS Studio esté abierto con WebSocket activo.');
    }
  };

  // Handshake step pipeline determination
  const stage = obsStatus.handshakeStage || (obsStatus.connected ? 'authenticated' : 'idle');

  const getStepStatus = (stepIndex: number) => {
    // 1: Socket Open, 2: Hello (OpCode 0), 3: Identify (OpCode 1), 4: Identified (OpCode 2), 5: Data Sync
    if (obsStatus.connected) return 'done';
    if (stage === 'failed') {
      if (stepIndex === 1) return 'error';
      return 'idle';
    }
    if (stage === 'opening_socket') {
      if (stepIndex === 1) return 'active';
      return 'idle';
    }
    if (stage === 'received_hello') {
      if (stepIndex <= 2) return 'done';
      return 'idle';
    }
    if (stage === 'identifying') {
      if (stepIndex <= 2) return 'done';
      if (stepIndex === 3) return 'active';
      return 'idle';
    }
    if (stage === 'authenticated') {
      return 'done';
    }
    return 'idle';
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'all') return true;
    return l.type === logFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner: Connection Status & Quick Control */}
      <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 glass-panel border border-white/10 bg-gradient-to-br from-[#151821] via-[#0E1015] to-[#0A0B0E] shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                OBS WebSocket v5 Protocol Engine
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-300 font-semibold font-mono">
                RPC v{obsStatus.rpcVersion ?? 1}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>Ajustes de Conexión OBS Studio</span>
              {obsStatus.connected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  ENLACE ACTIVO (LIVE)
                </span>
              ) : obsStatus.connecting || isTesting ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  NEGOCIANDO HANDSHAKE...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-white/10">
                  <WifiOff className="w-3.5 h-3.5" />
                  DESCONECTADO
                </span>
              )}
            </h1>

            <p className="text-xs lg:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Configura y gestiona la cadena de conexión WebSocket v5, contraseñas hash SHA-256, puertos TCP y monitorea la negociación de protocolo en vivo con OBS Studio.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {obsStatus.connected ? (
              <button
                onClick={onDisconnect}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-rose-950/20"
              >
                <Power className="w-4 h-4" />
                <span>Desconectar OBS</span>
              </button>
            ) : (
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isTesting || obsStatus.connecting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Probando Handshake...' : 'Conectar & Probar Handshake'}</span>
              </button>
            )}

            <button
              onClick={handleSaveConfig}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all flex items-center gap-2 active:scale-95"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Latencia Roundtrip</span>
            <div className="flex items-center gap-2 mt-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-base font-mono font-bold text-white">
                {obsStatus.connected ? `${obsStatus.latencyMs} ms` : '—'}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Protocolo OBS</span>
            <div className="flex items-center gap-2 mt-1">
              <Radio className="w-4 h-4 text-sky-400" />
              <span className="text-base font-mono font-bold text-white">
                {obsStatus.obsWebSocketVersion ? `v${obsStatus.obsWebSocketVersion}` : 'OBS-WS v5.x'}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Cámara Virtual</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${obsStatus.virtualCamActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-sm font-semibold text-white">
                {obsStatus.virtualCamActive ? 'Activa (Tally On)' : 'Inactiva'}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Escena al Aire (PGM)</span>
            <div className="flex items-center gap-2 mt-1">
              <Layers className="w-4 h-4 text-[#FF6B00]" />
              <span className="text-xs font-mono font-bold text-slate-200 truncate" title={obsStatus.currentProgramScene}>
                {obsStatus.currentProgramScene}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Step-by-Step Connection Handshake Stepper */}
      <div className="rounded-3xl p-6 lg:p-8 glass-panel border border-white/10 bg-[#101217]/90 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-sky-400" />
              <span>Pipeline de Handshake OBS WebSocket v5</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualización en tiempo real de las 5 etapas del protocolo de sincronización y autenticación.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Estado:</span>
            {obsStatus.connected ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Handshake Completado
              </span>
            ) : stage === 'failed' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Falló ({obsStatus.lastError || 'Rechazado'})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-slate-300 border border-white/10">
                En espera de inicio
              </span>
            )}
          </div>
        </div>

        {/* 5-Stage Stepper Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {/* Step 1: TCP/WS Open */}
          {(() => {
            const st = getStepStatus(1);
            return (
              <div className={`p-4 rounded-2xl border transition-all ${
                st === 'done' 
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : st === 'active'
                  ? 'bg-sky-950/30 border-sky-500/50 text-sky-300 animate-pulse'
                  : st === 'error'
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  : 'bg-white/[0.02] border-white/5 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Paso 1</span>
                  {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   st === 'active' ? <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" /> :
                   st === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> :
                   <Wifi className="w-4 h-4 text-slate-500" />}
                </div>
                <h3 className="text-xs font-bold text-white">Apertura Socket</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Handshake TCP y apertura de túnel WebSocket a {targetUrlLabel(host, port)}.
                </p>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span>Op: TCP/WS</span>
                  <span className={st === 'done' ? 'text-emerald-400 font-bold' : st === 'error' ? 'text-rose-400 font-bold' : ''}>
                    {st === 'done' ? 'Abierto' : st === 'active' ? 'Conectando...' : st === 'error' ? 'Error' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Step 2: Hello OpCode 0 */}
          {(() => {
            const st = getStepStatus(2);
            return (
              <div className={`p-4 rounded-2xl border transition-all ${
                st === 'done' 
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : st === 'active'
                  ? 'bg-sky-950/30 border-sky-500/50 text-sky-300 animate-pulse'
                  : 'bg-white/[0.02] border-white/5 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Paso 2</span>
                  {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   st === 'active' ? <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" /> :
                   <Radio className="w-4 h-4 text-slate-500" />}
                </div>
                <h3 className="text-xs font-bold text-white">Hello (OpCode 0)</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  OBS saluda enviando versión RPC y requerimientos de challenge/salt.
                </p>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span>OpCode 0</span>
                  <span className={st === 'done' ? 'text-emerald-400 font-bold' : ''}>
                    {st === 'done' ? 'Negociado' : st === 'active' ? 'Esperando...' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Step 3: Identify OpCode 1 */}
          {(() => {
            const st = getStepStatus(3);
            return (
              <div className={`p-4 rounded-2xl border transition-all ${
                st === 'done' 
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : st === 'active'
                  ? 'bg-sky-950/30 border-sky-500/50 text-sky-300 animate-pulse'
                  : 'bg-white/[0.02] border-white/5 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Paso 3</span>
                  {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   st === 'active' ? <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" /> :
                   <KeyRound className="w-4 h-4 text-slate-500" />}
                </div>
                <h3 className="text-xs font-bold text-white">Identify (OpCode 1)</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Cálculo del hash SHA-256 (Base64) y envío de suscripción a eventos.
                </p>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span>OpCode 1</span>
                  <span className={st === 'done' ? 'text-emerald-400 font-bold' : ''}>
                    {st === 'done' ? 'Autenticado' : st === 'active' ? 'Hashing...' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Step 4: Identified OpCode 2 */}
          {(() => {
            const st = getStepStatus(4);
            return (
              <div className={`p-4 rounded-2xl border transition-all ${
                st === 'done' 
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : st === 'active'
                  ? 'bg-sky-950/30 border-sky-500/50 text-sky-300 animate-pulse'
                  : 'bg-white/[0.02] border-white/5 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Paso 4</span>
                  {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   st === 'active' ? <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" /> :
                   <ShieldCheck className="w-4 h-4 text-slate-500" />}
                </div>
                <h3 className="text-xs font-bold text-white">Identified (OpCode 2)</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  OBS confirma credenciales y autoriza el canal de comandos RPC.
                </p>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span>OpCode 2</span>
                  <span className={st === 'done' ? 'text-emerald-400 font-bold' : ''}>
                    {st === 'done' ? 'Confirmado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Step 5: Data Sync & Telemetry */}
          {(() => {
            const st = getStepStatus(5);
            return (
              <div className={`p-4 rounded-2xl border transition-all ${
                st === 'done' 
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/[0.02] border-white/5 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Paso 5</span>
                  {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                   <Layers className="w-4 h-4 text-slate-500" />}
                </div>
                <h3 className="text-xs font-bold text-white">Sincronización</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Carga de escenas, fuentes, estado VirtualCam y telemetría a 60 FPS.
                </p>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span>RPC & Telemetry</span>
                  <span className={st === 'done' ? 'text-emerald-400 font-bold' : ''}>
                    {st === 'done' ? 'Activo' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main Form & URL Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl p-6 lg:p-7 glass-panel border border-white/10 bg-[#101217]/90 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#FF6B00]" />
                  <span>Parámetros de Enlace WebSocket</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Configura la dirección de destino y credenciales de autenticación.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHost('127.0.0.1');
                  setPort(4455);
                  setUseSsl(false);
                  setAutoConnect(true);
                  onShowToast('info', 'Valores por Defecto Restaurados', '127.0.0.1:4455');
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 transition-all font-mono"
              >
                Restablecer estándar
              </button>
            </div>

            <div className="space-y-5">
              {/* Host / Connection String */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-sky-400" />
                    <span>Host / Dirección IP</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">127.0.0.1 o IP local</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="127.0.0.1 o ws://..."
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 focus:border-sky-500 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>

                {/* Host Presets */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Atajos:</span>
                  <button
                    type="button"
                    onClick={() => setHost('127.0.0.1')}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${
                      host === '127.0.0.1'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    127.0.0.1 (Local)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHost('localhost')}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded-lg transition-all ${
                      host === 'localhost'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    localhost
                  </button>
                  <button
                    type="button"
                    onClick={() => setHost('192.168.1.100')}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    LAN (192.168.x.x)
                  </button>
                </div>
              </div>

              {/* Port Configuration */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-amber-400" />
                    <span>Puerto WebSocket TCP</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">1 – 65535</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                    placeholder="4455"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 focus:border-amber-500 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />

                  {/* Port Preset buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPort(4455)}
                      className={`flex-1 py-2 px-3 text-xs font-mono font-bold rounded-xl border transition-all text-center ${
                        port === 4455
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      4455 (v5 Estándar)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPort(4444)}
                      className={`flex-1 py-2 px-3 text-xs font-mono font-bold rounded-xl border transition-all text-center ${
                        port === 4444
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      4444 (v4 Legacy)
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Settings */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                    <span>Contraseña del Servidor WebSocket</span>
                  </label>
                  {password ? (
                    <span className="text-[11px] text-purple-300 flex items-center gap-1 font-semibold">
                      <Lock className="w-3 h-3" /> Hash SHA-256 habilitado
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Sin autenticación
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña configurada en OBS (o vacío si no tiene)"
                    className="w-full pl-4 pr-11 py-2.5 bg-black/40 border border-white/15 focus:border-purple-500 rounded-xl text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Esta contraseña se cifra localmente mediante algoritmo de desafío <strong>SHA-256 con salt</strong> especificado por OBS v5. Nunca viaja en texto plano.
                </p>
              </div>

              {/* Toggles: Protocol & AutoConnect */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* SSL/WSS Toggle */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Cifrado SSL / TLS (WSS)</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSsl}
                        onChange={(e) => setUseSsl(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Usa <code>wss://</code> para túneles remotos con certificado TLS o proxy inverso HTTPS.
                  </p>
                </div>

                {/* Auto-Connect Toggle */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-sky-400" />
                      <span>Auto-Reconexión</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoConnect}
                        onChange={(e) => setAutoConnect(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Reintenta la conexión automáticamente al iniciar o ante caídas del servidor OBS.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Connection String Inspector & Browser Security Notice (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* URL Inspector & Copy */}
          <div className="rounded-3xl p-6 glass-panel border border-white/10 bg-[#101217]/90 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>Cadena de Conexión Activa</span>
              </h2>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white transition-all active:scale-95 border border-white/10"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? '¡Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>

            {/* Computed URL Box */}
            <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-sky-300 break-all select-all flex items-center justify-between">
              <span>{computedUrl}</span>
            </div>

            {/* Syntax Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-slate-500 block">PROTOCOLO</span>
                <span className="font-bold text-sky-400">{protocol}://</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-slate-500 block">HOST IP</span>
                <span className="font-bold text-slate-200 truncate block">{rawHost}</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-slate-500 block">PUERTO</span>
                <span className="font-bold text-amber-400">:{port}</span>
              </div>
            </div>

            {/* Browser Mixed Content Advisory */}
            {isHttps && !useSsl && (
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-xs">Nota de Seguridad del Navegador (HTTPS)</h4>
                    <p className="text-[11px] text-amber-200/90 mt-1 leading-relaxed">
                      Estás usando la app a través de una URL segura HTTPS. Los navegadores modernos bloquean peticiones WebSocket <code>ws://</code> remotas no seguras.
                    </p>
                    <div className="mt-2 text-[11px] text-slate-300 list-disc list-inside space-y-1">
                      <div>• Para OBS local en la misma PC: Chrome y Edge permiten <code>ws://127.0.0.1:4455</code> directamente.</div>
                      <div>• O ejecuta la app en <code>http://localhost:3000</code> para evitar bloqueos por completo.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick OBS Setup Checklist */}
          <div className="rounded-3xl p-6 glass-panel border border-white/10 bg-[#101217]/90 shadow-xl space-y-3.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#FF6B00]" />
              <span>Guía Rápida: Activar WebSocket en OBS</span>
            </h2>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="text-white">Abre OBS Studio 28+</strong> y ve al menú superior: <br />
                  <code className="text-sky-300 font-mono text-[11px]">Herramientas &gt; Configuración del servidor WebSocket</code>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="text-white">Marca la casilla</strong>: <br />
                  <span className="text-emerald-400 font-semibold">«Habilitar el servidor WebSocket»</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="w-5 h-5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong className="text-white">Comprueba el puerto y contraseña</strong>: <br />
                  Haz clic en <span className="text-slate-200">«Mostrar información de conexión»</span> y copia la contraseña si la casilla de autenticación está marcada.
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Runtime Verification Card */}
          <div className="atem-module p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00C853]" />
                <span>Runtime Local V4.2</span>
              </h2>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[#00C853]/15 text-[#69F0AE] border border-[#00C853]/40">
                OBS WS v5
              </span>
            </div>

            <p className="text-[11px] text-[#8E95A3] leading-relaxed">
              Estación de control local conectada mediante protocolo nativo OBS WebSocket v5 (SHA-256 Challenge/Auth) y servidor HTTP de gráficas Browser Source en loopback.
            </p>
          </div>
        </div>
      </div>

      {/* Terminal Feed: Live Handshake Logs & Event Feed */}
      <div className="rounded-3xl p-6 glass-panel border border-white/10 bg-[#0C0E12] shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Registro de Eventos y Handshake en Vivo</h2>
              <p className="text-xs text-slate-400">
                Transmisión continua de paquetes OpCode, mensajes Hello y confirmaciones de protocolo.
              </p>
            </div>
          </div>

          {/* Log Controls & Level Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/10 text-[11px]">
              {(['all', 'info', 'success', 'warn', 'error'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setLogFilter(filterKey)}
                  className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all ${
                    logFilter === filterKey
                      ? 'bg-white/15 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filterKey === 'all' ? 'Todos' : filterKey === 'warn' ? 'Alertas' : filterKey}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                obsService.clearLogs();
                setLogs([]);
                onShowToast('info', 'Terminal Limpiado');
              }}
              className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
              title="Limpiar registro de terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Console Window */}
        <div className="rounded-2xl bg-black/80 border border-white/10 p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-2 select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 py-6 text-center">
              No hay eventos en este nivel de filtro. Haz clic en "Conectar & Probar Handshake" para registrar actividad.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const colorClass =
                log.type === 'success'
                  ? 'text-emerald-400'
                  : log.type === 'warn'
                  ? 'text-amber-400'
                  : log.type === 'error'
                  ? 'text-rose-400'
                  : 'text-sky-300';

              const badgeBg =
                log.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : log.type === 'warn'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : log.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-sky-500/20 text-sky-400 border-sky-500/30';

              return (
                <div key={index} className="flex items-start gap-3 py-0.5 leading-relaxed hover:bg-white/[0.02] px-1 rounded">
                  <span className="text-slate-500 shrink-0 text-[11px]">{log.time}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border shrink-0 ${badgeBg}`}>
                    {log.type}
                  </span>
                  <span className={`break-all ${colorClass}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

function targetUrlLabel(host: string, port: number): string {
  const h = (host || '127.0.0.1').trim();
  if (h.startsWith('ws://') || h.startsWith('wss://')) return h;
  return `${h}:${port}`;
}
