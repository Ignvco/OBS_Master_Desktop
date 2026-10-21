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
  Layers, 
  Tv, 
  ListCheck, 
  FolderKanban, 
  Sparkles,
  ExternalLink,
  Download
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
}) => {
  const spaces: { id: NavigationSpace; label: string; icon: React.ReactNode }[] = [
    { id: 'inicio', label: 'Inicio', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'preparacion', label: 'Preparación', icon: <ListCheck className="w-3.5 h-3.5" /> },
    { id: 'en-vivo', label: 'En Vivo', icon: <Tv className="w-3.5 h-3.5" /> },
    { id: 'content-studio', label: 'Content Studio', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'biblioteca', label: 'Biblioteca', icon: <FolderKanban className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-16 px-4 sm:px-6 glass-panel border-b border-white/[0.08] flex items-center justify-between gap-3 sm:gap-6 shrink-0 select-none z-30 overflow-x-auto">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <a 
          href="#inicio"
          onClick={(e) => { e.preventDefault(); onNavigate('inicio'); }}
          className="flex items-center gap-2.5 group focus:outline-none"
        >
          {/* Spotlight logo mark */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6B00] to-[#E85D04] flex items-center justify-center shadow-lg shadow-[#FF6B00]/25 group-hover:scale-105 transition-transform shrink-0">
            <svg viewBox="0 0 100 100" className="w-5 h-5 text-white fill-current">
              <path d="M45 15 L55 15 L55 35 C55 40 65 50 65 65 A20 20 0 1 1 25 65 C25 50 35 40 35 35 Z" opacity="0.95" />
              <circle cx="50" cy="72" r="10" fill="#FFF9F5" />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white font-sans uppercase whitespace-nowrap">
                Si Te Dijera Que?
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30 rounded tracking-wider">
                V3.0.2
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium hidden xs:inline whitespace-nowrap">
              Broadcast Station
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Navigation Spaces Tabs (Apple HIG Segmented Control) */}
      <nav aria-label="Espacios de trabajo" className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] shrink-0 overflow-x-auto">
        {spaces.map((space) => {
          const isActive = activeSpace === space.id;
          return (
            <button
              key={space.id}
              onClick={() => onNavigate(space.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-white/15 to-white/10 text-white shadow-sm border border-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className={isActive ? 'text-[#FF6B00]' : 'text-slate-500'}>
                {space.icon}
              </span>
              <span>{space.label}</span>
              {space.id === 'en-vivo' && obsStatus.virtualCamActive && (
                <span className="relative flex h-2 w-2 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Broadcast Telemetry & Critical Control Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Episode Indicator Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300">
          <span className="text-[10px] font-bold text-[#FF6B00] uppercase tracking-wider">Episodio</span>
          <span className="font-semibold text-white">#{episodeNumber}</span>
        </div>

        {/* OBS Status Pill Button */}
        <button
          onClick={onOpenConnectionModal}
          title="Configuración de conexión OBS Studio (WebSocket v5)"
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
            obsStatus.connected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : obsStatus.connecting
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
          }`}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            obsStatus.connected
              ? 'bg-emerald-400 animate-pulse'
              : obsStatus.connecting
              ? 'bg-amber-400 animate-ping'
              : 'bg-rose-500'
          }`} />
          <span className="hidden md:inline">
            {obsStatus.connected 
              ? `OBS Conectado (${obsStatus.latencyMs}ms)`
              : obsStatus.connecting 
              ? 'Conectando a OBS...' 
              : 'OBS Desconectado'}
          </span>
        </button>

        {/* OBS Virtual Camera Toggle */}
        <button
          onClick={onToggleVirtualCam}
          title={obsStatus.virtualCamActive ? "Cámara virtual activa en OBS; comprobar recepción en StreamYard" : "Activar cámara virtual de OBS (no inicia StreamYard)"}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
            obsStatus.virtualCamActive
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/20'
              : 'bg-black/30 text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20'
          }`}
        >
          <Video className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden lg:inline">Cámara Virtual</span>
          <span className={`text-[10px] px-1 rounded ${obsStatus.virtualCamActive ? 'bg-sky-500 text-black font-extrabold' : 'bg-slate-700 text-slate-300'}`}>
            {obsStatus.virtualCamActive ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Safe Mode / Protect On-Air Actions */}
        <button
          onClick={onToggleProtectedMode}
          title={isProtectedMode ? "Modo Protegido Activo" : "Modo Edición Libre"}
          className={`p-2 rounded-xl border transition-all shrink-0 ${
            isProtectedMode
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-black/30 text-slate-400 border-white/10 hover:text-slate-200'
          }`}
          aria-label={isProtectedMode ? "Desactivar modo protegido" : "Activar modo protegido"}
        >
          {isProtectedMode ? (
            <Shield className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>
    </header>
  );
};
