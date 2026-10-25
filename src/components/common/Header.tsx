import React from 'react';
import { 
  NavigationSpace, 
  OBSStatus 
} from '../../types';
import { 
  Radio, 
  Video, 
  Shield, 
  ShieldAlert, 
  Tv, 
  ListCheck, 
  FolderKanban, 
  Sliders
} from 'lucide-react';

interface HeaderProps {
  activeSpace: NavigationSpace;
  onNavigate: (space: NavigationSpace) => void;
  obsStatus: OBSStatus;
  isProtectedMode: boolean;
  onToggleProtectedMode: () => void;
  onOpenConnectionModal: () => void;
  onToggleVirtualCam: () => void;
  episodeNumber: number;
  activeGraphicsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeSpace,
  onNavigate,
  obsStatus,
  isProtectedMode,
  onToggleProtectedMode,
  onOpenConnectionModal,
  onToggleVirtualCam,
  episodeNumber,
  activeGraphicsCount = 0,
}) => {
  const spaces: { id: NavigationSpace; keyNum: string; label: string; icon: React.ReactNode }[] = [
    { id: 'inicio', keyNum: '1', label: 'Inicio', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'content-studio', keyNum: '2', label: 'Diseñar', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'preparacion', keyNum: '3', label: 'Preparar', icon: <ListCheck className="w-3.5 h-3.5" /> },
    { id: 'en-vivo', keyNum: '4', label: 'En Vivo', icon: <Tv className="w-3.5 h-3.5" /> },
    { id: 'biblioteca', keyNum: '5', label: 'Biblioteca', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-13 px-3 sm:px-4 bg-[#0d1016] border-b border-[#252b37] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_14px_rgba(0,0,0,0.5)] flex items-center justify-between gap-2 sm:gap-4 shrink-0 select-none z-30 overflow-x-auto">
      {/* Zone 1: Station Hardware Identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <a 
          href="#inicio"
          onClick={(e) => { e.preventDefault(); onNavigate('inicio'); }}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded bg-[#06080b] border border-[#2c3444] flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.85)] group-hover:border-sky-400/50 transition-colors shrink-0 relative overflow-hidden">
            <span className={`absolute inset-x-0 top-0 h-[2px] ${activeGraphicsCount > 0 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : obsStatus.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <svg viewBox="0 0 100 100" className="w-4 h-4 text-slate-100 fill-current mt-0.5">
              <path d="M45 15 L55 15 L55 35 C55 40 65 50 65 65 A20 20 0 1 1 25 65 C25 50 35 40 35 35 Z" opacity="0.92" />
              <circle cx="50" cy="72" r="10" fill="#38BDF8" />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-[0.06em] text-slate-100 font-sans uppercase whitespace-nowrap">
                OBS MASTER
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-[#06080b] text-sky-400 border border-[#262c38] rounded">
                V4.2
              </span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-slate-500 hidden sm:inline whitespace-nowrap">
              STDQ · BROADCAST CONTROL
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: ATEM Console Bank Selector */}
      <nav aria-label="Espacios de trabajo" className="atem-well flex items-center gap-1 shrink-0 overflow-x-auto">
        {spaces.map((space) => {
          const isActive = activeSpace === space.id;
          const isLiveSpace = space.id === 'en-vivo';
          const hasLiveOnAir = isLiveSpace && activeGraphicsCount > 0;

          let btnStyle = 'bg-gradient-to-b from-[#1a1f29] to-[#12161e] text-slate-400 border-[#262c38] hover:text-slate-100 hover:border-[#374151]';
          let topBarStyle = 'bg-[#2a3140]';

          if (isActive && isLiveSpace) {
            btnStyle = 'atem-btn-pgm text-white';
            topBarStyle = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
          } else if (isActive) {
            btnStyle = 'bg-gradient-to-b from-[#232b3a] to-[#181e29] text-white border-sky-400/70 shadow-[0_0_12px_rgba(56,189,248,0.18)]';
            topBarStyle = 'bg-sky-400 shadow-[0_0_8px_#38bdf8]';
          } else if (hasLiveOnAir) {
            btnStyle = 'bg-gradient-to-b from-[#2c1419] to-[#1b0c10] text-red-200 border-red-500/50 hover:border-red-400';
            topBarStyle = 'bg-red-500 animate-pulse';
          }

          return (
            <button
              key={space.id}
              type="button"
              onClick={() => onNavigate(space.id)}
              title={`${space.label} (Atajo: tecla ${space.keyNum})`}
              className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[4px] border text-xs font-bold whitespace-nowrap transition-all duration-100 shrink-0 overflow-hidden ${btnStyle}`}
            >
              <span className={`absolute inset-x-0 top-0 h-[2px] ${topBarStyle}`} />
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/40 text-slate-400 border border-white/5">
                {space.keyNum}
              </span>
              <span className={isActive ? (isLiveSpace ? 'text-red-400' : 'text-sky-400') : 'text-slate-400'}>
                {space.icon}
              </span>
              <span className="tracking-tight">{space.label}</span>
              {isLiveSpace && activeGraphicsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded bg-red-600 text-white font-mono text-[9px] font-black tracking-wider">
                  {activeGraphicsCount} AIR
                </span>
              )}
              {space.id === 'en-vivo' && obsStatus.virtualCamActive && (
                <span className="flex h-2 w-2 ml-0.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]"
                  title="Cámara virtual de OBS activa (emisión externa no confirmada)"
                  aria-label="Cámara virtual OBS activa" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Signal Readout & Hardware Transport Switches */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Recessed LCD Signal Readout */}
        <div className="hidden xl:flex items-center gap-2.5 px-2.5 py-1 atem-readout text-[11px]">
          <div className="flex items-center gap-1 border-r border-[#1f2532] pr-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase">EP</span>
            <span className="font-bold text-slate-200">#{episodeNumber}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${obsStatus.connected && obsStatus.currentScene ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-bold text-red-400 uppercase">PGM</span>
            <span className="text-slate-200 font-semibold max-w-[110px] truncate" title={obsStatus.currentScene || 'Sin escena Program'}>
              {obsStatus.connected ? (obsStatus.currentScene || '—') : 'OFFLINE'}
            </span>
          </div>
          {obsStatus.connected && obsStatus.studioMode && (
            <div className="flex items-center gap-1.5 border-l border-[#1f2532] pl-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#22c55e]" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase">PVW</span>
              <span className="text-slate-300 max-w-[100px] truncate" title={obsStatus.currentPreviewScene || 'Sin escena Preview'}>
                {obsStatus.currentPreviewScene || '—'}
              </span>
            </div>
          )}
        </div>

        {/* OBS WebSocket Link Switch */}
        <button
          type="button"
          onClick={onOpenConnectionModal}
          title="Configuración de conexión OBS Studio (WebSocket v5)"
          className={`atem-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold shrink-0 ${
            obsStatus.connected
              ? 'atem-btn-pvw'
              : obsStatus.connecting
              ? 'atem-btn-amber'
              : 'border-red-500/50 text-red-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            obsStatus.connected
              ? 'bg-emerald-400 shadow-[0_0_6px_#22c55e]'
              : obsStatus.connecting
              ? 'bg-amber-400 animate-ping'
              : 'bg-red-500 shadow-[0_0_6px_#ef4444]'
          }`} />
          <span className="hidden md:inline font-mono text-[11px]">
            {obsStatus.connected 
              ? `OBS · ${obsStatus.latencyMs}ms`
              : obsStatus.connecting 
              ? 'OBS · SYNC...' 
              : 'CONECTAR OBS'}
          </span>
        </button>

        {/* OBS Virtual Camera Switch */}
        <button type="button"
          onClick={onToggleVirtualCam}
          disabled={!obsStatus.connected}
          aria-pressed={obsStatus.virtualCamActive}
          aria-label={obsStatus.virtualCamActive ? 'Detener cámara virtual OBS' : 'Activar cámara virtual OBS'}
          title={!obsStatus.connected ? "Conecta OBS antes de controlar su cámara virtual" : obsStatus.virtualCamActive ? "Cámara virtual activa en OBS; comprobar recepción en StreamYard" : "Activar cámara virtual de OBS (no inicia StreamYard)"}
          className={`atem-btn flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
            obsStatus.virtualCamActive
              ? 'border-sky-400 text-sky-100 shadow-[inset_0_2px_0_#38bdf8,0_0_12px_rgba(56,189,248,0.25)]'
              : ''
          }`}
        >
          <Video className={`w-3.5 h-3.5 shrink-0 ${obsStatus.virtualCamActive ? 'text-sky-400' : 'text-slate-400'}`} />
          <span className="hidden lg:inline text-[11px]">Cámara OBS</span>
          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${obsStatus.virtualCamActive ? 'bg-sky-400 text-slate-950 font-black' : 'bg-[#06080b] text-slate-400 border border-[#262c38]'}`}>
            {obsStatus.virtualCamActive ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Protected Mode Safety Latch */}
        <button type="button"
          onClick={onToggleProtectedMode}
          aria-pressed={isProtectedMode}
          title={isProtectedMode ? "Modo Protegido Activo: evita cortes accidentales directos en Program" : "Modo Directo sin protección: los clics pueden conmutar Program inmediatamente"}
          className={`atem-btn flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold shrink-0 ${
            isProtectedMode ? 'atem-btn-amber' : ''
          }`}
          aria-label={isProtectedMode ? "Protección activa: desactivar modo protegido" : "Protección desactivada: activar modo protegido"}
        >
          {isProtectedMode ? (
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="hidden 2xl:inline text-[11px] font-mono uppercase">
            {isProtectedMode ? 'PROTEGIDO' : 'DIRECTO'}
          </span>
        </button>
      </div>
    </header>
  );
};
