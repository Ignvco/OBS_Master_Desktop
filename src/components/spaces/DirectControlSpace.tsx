import React from 'react';
import type { ComponentType, CustomComponentRegistry, EditorialComponentConfig } from '../../types';

interface Props {
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents: CustomComponentRegistry;
  busy: string[];
  feedback: string;
  onToggle(id: string): void;
  onReplay(id: string): void;
  onHideAll(): void;
  onEdit(id: string): void;
}
export function DirectControlSpace({components,customComponents,busy,feedback,onToggle,onReplay,onHideAll,onEdit}:Props) {
  const items = [...Object.entries(components).map(([id,config])=>({id,config})),...Object.entries(customComponents).map(([id,config])=>({id,config}))];
  return <div className="flex-1 overflow-y-auto px-5 py-6 max-w-[1600px] mx-auto w-full text-slate-100 space-y-5">
    <header className="rounded-2xl border border-orange-400/20 bg-white/[.04] p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs tracking-[.22em] text-orange-300">OBS MASTER · DIRECT</div>
          <h1 className="text-2xl font-bold mt-1">En Vivo · Direct</h1>
          <p className="text-slate-400 text-sm mt-1">Control de gráficas publicadas sin OBS WebSocket.</p></div>
        <button onClick={onHideAll} disabled={busy.length>0} className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-4 py-2 text-sm font-bold disabled:opacity-40">Ocultar todas</button>
      </div>
      <div role="status" aria-live="polite" className="rounded-lg bg-slate-900/80 p-3 text-xs text-slate-300">{feedback}</div>
      <p className="text-xs text-amber-200/90">Los estados aquí indican confirmación del servidor local. No verifican visualmente la señal en Unity Capture ni en StreamYard. Mantén Direct Engine Lab abierto durante las pruebas.</p>
      <p className="text-xs text-slate-400">Para publicar una gráfica, ocúltala primero, publica en Content Studio y vuelve a mostrarla. Las revisiones solo se crean al guardarlas deliberadamente.</p>
    </header>
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map(({id,config})=><article key={id} className={'rounded-2xl border p-4 space-y-3 '+(config.visibleInOBS?'border-orange-400/50 bg-orange-400/10':'border-white/10 bg-white/[.03]')}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-sm truncate" title={config.name}>{config.name}</h2>
          <span className={'text-[10px] font-bold '+(config.visibleInOBS?'text-orange-300':'text-slate-400')}>{config.visibleInOBS?'VISIBLE':'OCULTA'}</span>
        </div>
        <p className="text-xs text-slate-400">Motion: {config.animation?.preset || 'Sin preset'} · Capas: {config.layers?.length??0}</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy.includes(id)} onClick={()=>onToggle(id)} className="bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg py-2 px-3 text-xs">{config.visibleInOBS?'Ocultar':'Mostrar'}</button>
          <button disabled={!config.visibleInOBS || busy.includes(id)} onClick={()=>onReplay(id)} className="bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg py-2 px-3 text-xs">↻ Motion</button>
          <button onClick={()=>onEdit(id)} className="bg-white/10 hover:bg-white/20 rounded-lg py-2 px-3 text-xs">Editar</button>
        </div>
      </article>)}
    </section>
  </div>;
}
