import React, { useEffect, useRef, useState } from 'react';
import { Command, Search, X, ArrowRight, Keyboard } from 'lucide-react';

export type StudioCommand = { id: string; label: string; description: string; shortcut?: string; run: () => void; disabled?: boolean };

type Props = { open: boolean; onClose: () => void; commands: StudioCommand[] };

/** Editor-only command launcher. Does not create, publish or alter OBS sources. */
export function StudioCommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) { setQuery(''); setActive(0); inputRef.current?.focus(); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [open, onClose]);
  if (!open) return null;
  const normalized = query.trim().toLocaleLowerCase('es');
  const filtered = commands.filter(c => `${c.label} ${c.description}`.toLocaleLowerCase('es').includes(normalized));
  const selected = Math.max(0, Math.min(active, filtered.length - 1));
  const execute = (command: StudioCommand | undefined) => {
    if (!command || command.disabled) return;
    onClose(); command.run();
  };
  return <div className="studio-palette-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="studio-palette" role="dialog" aria-modal="true" aria-labelledby="studio-command-title">
      <div className="studio-palette-search">
        <Search size={20} className="shrink-0 text-orange-300" aria-hidden="true"/>
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setActive(0); }}
          placeholder="Buscar acción del editor…" aria-label="Buscar acciones del editor"
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(v => Math.min(v + 1, filtered.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActive(v => Math.max(0, v - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); execute(filtered[selected]); }
          }}/>
        <button type="button" onClick={onClose} className="studio-palette-dismiss" aria-label="Cerrar acciones"><X size={18}/></button>
      </div>
      <div className="studio-palette-list">
        <h2 id="studio-command-title" className="studio-palette-caption"><Command size={13}/> Acciones de Content Studio · solo edición y vista previa</h2>
        {filtered.map((item,index) => <button key={item.id} type="button" disabled={item.disabled}
          className={`studio-palette-item ${index === selected ? 'studio-palette-item-selected' : ''}`}
          onMouseEnter={() => setActive(index)} onClick={() => execute(item)}>
          <span className="studio-palette-dot" aria-hidden="true"/>
          <span className="flex-1 text-left min-w-0"><span className="block text-[13px] font-semibold text-slate-100">{item.label}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">{item.description}</span></span>
          {item.shortcut && <kbd className="studio-palette-kbd">{item.shortcut}</kbd>}
          <ArrowRight size={14} className="text-slate-500"/>
        </button>)}
        {!filtered.length && <p className="px-6 py-8 text-sm text-slate-400 text-center">No se encontraron acciones.</p>}
      </div>
      <footer className="studio-palette-footer"><Keyboard size={14}/> ↑ ↓ para navegar <span>·</span> Enter ejecutar <span>·</span> Esc cerrar
        <span className="ml-auto opacity-75">Sin acciones de emisión</span></footer>
    </section>
  </div>;
}
