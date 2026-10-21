import React, { useEffect, useState } from 'react';
import { ArchiveRestore, HardDriveDownload, ShieldCheck, RefreshCw, AlertTriangle, FileCheck2, DatabaseBackup } from 'lucide-react';
import type { OBSStatus } from '../../types';
import { recoveryService, type RecoverySnapshot } from '../../services/recoveryService';

/** Explicit maintenance actions only, never automatic restoration while on-air. */
export function RecoveryCenter({ obsStatus }: { obsStatus: OBSStatus }) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [fault, setFault] = useState('');
  const [selection, setSelection] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const refresh = async () => {
    try { setSnapshot(await recoveryService.check()); setFault(''); }
    catch (e: any) { setFault(e.message); }
  };
  useEffect(() => { void refresh(); }, []);
  const execute = async (action: 'backup'|'restore') => {
    if (busy) return;
    setBusy(true); setNotice(''); setFault('');
    try {
      if (action === 'backup') { await recoveryService.backup(); setNotice('Respaldo verificado y guardado en AppData.'); }
      else {
        if (!selection || confirmText !== 'RESTAURAR' || obsStatus.connected || obsStatus.virtualCamActive) {
          throw new Error('Desconecta OBS y confirma RESTAURAR antes de recuperar los datos.');
        }
        await recoveryService.restore(selection);
        setNotice('Restauración completada. Recarga la aplicación para leer la sesión recuperada.');
        setSelection(''); setConfirmText('');
      }
      await refresh();
    } catch (e: any) { setFault(e.message); }
    finally { setBusy(false); }
  };
  const exportReport = () => {
    const safe = {
      exportedAt: new Date().toISOString(), application: 'OBS MASTER Desktop',
      // Never export passwords, addresses, media names, or sensitive episode text.
      obs: { connected: obsStatus.connected, studioMode: obsStatus.studioMode,
        virtualCamActive: obsStatus.virtualCamActive, scenes: obsStatus.scenes.length },
      runtime: snapshot?.diagnostics, backups: snapshot?.backups.map(x=>({date:x.createdAt, count:x.files.length, bytes:x.totalBytes})),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'STDQ_DIAGNOSTICO_SIN_CREDENCIALES.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  };
  return <div className="space-y-5 max-w-5xl">
    <div className="rounded-3xl glass-panel p-6 border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div><h2 className="font-extrabold text-xl text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-[#FF6B00]"/> Recovery Center</h2>
          <p className="text-slate-400 text-sm mt-1">Diagnóstico y respaldos de producción. Sin contraseñas WebSocket.</p></div>
        <button onClick={()=>void refresh()} disabled={busy} className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/15 disabled:opacity-40 flex gap-2 items-center"><RefreshCw size={15}/> Actualizar diagnóstico</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 bg-black/30 border border-white/10"><p className="text-xs text-slate-400">OBS WebSocket</p><p className={`font-bold mt-2 ${obsStatus.connected?'text-emerald-300':'text-amber-300'}`}>{obsStatus.connected?'Conectado':'Desconectado'}</p></div>
        <div className="rounded-2xl p-4 bg-black/30 border border-white/10"><p className="text-xs text-slate-400">Cámara virtual</p><p className="font-bold mt-2">{obsStatus.virtualCamActive?'Activa':'Inactiva'}</p></div>
        <div className="rounded-2xl p-4 bg-black/30 border border-white/10"><p className="text-xs text-slate-400">Respaldos disponibles</p><p className="font-bold mt-2">{snapshot?.backups.length ?? '—'}</p></div>
      </div>
      <div className="mt-4 space-y-2">
        {snapshot?.diagnostics.checks.map(item => <div key={item.id} className="flex items-center gap-2 text-sm"><FileCheck2 size={16} className={item.ok?'text-emerald-400':'text-rose-400'}/><span className="font-semibold">{item.id}</span><span className="text-slate-400">— {item.description}</span></div>)}
      </div>
      <button onClick={exportReport} disabled={!snapshot} className="mt-4 text-[#FF8A3C] text-sm font-semibold hover:underline disabled:opacity-50">Exportar diagnóstico (sin secretos)</button>
    </div>
    <div className="rounded-3xl glass-panel p-6 border border-white/10 space-y-4">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div><h3 className="text-lg font-bold flex gap-2 items-center"><DatabaseBackup className="text-[#FF6B00]" size={20}/> Puntos de recuperación</h3>
          <p className="text-sm text-slate-400 mt-1">Hasta 5 copias locales de Biblioteca, gráficas, imágenes y medios (máx. 512 MB por respaldo). Crea respaldos antes o después de emitir.</p></div>
        <button disabled={busy || obsStatus.virtualCamActive} onClick={()=>void execute('backup')} className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FA7A26] text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"><HardDriveDownload size={17}/> Crear respaldo</button>
      </div>
      {snapshot?.backups.length ? <div className="space-y-2">
        {snapshot.backups.map(b => <label key={b.id} className={`flex gap-3 items-center p-3 rounded-xl border cursor-pointer ${selection===b.id?'border-[#FF6B00] bg-[#FF6B00]/10':'border-white/10 bg-black/20'}`}>
          <input type="radio" name="recovery-backup" checked={selection===b.id} onChange={()=>{setSelection(b.id);setConfirmText('');}}/>
          <div className="flex-1"><p className="font-semibold text-sm">{new Date(b.createdAt).toLocaleString('es-CL')}</p><p className="text-xs text-slate-400">{b.files.length} archivos · {(b.totalBytes/1024/1024).toFixed(1)} MB</p></div>
        </label>)}
      </div> : <p className="text-sm text-slate-500">Todavía no hay puntos de recuperación.</p>}
      {selection && <div className="border border-amber-500/30 rounded-xl bg-amber-500/10 p-4 space-y-3">
        <p className="text-sm text-amber-200 flex items-center gap-2"><AlertTriangle size={18}/> Restaurar reemplaza el estado guardado. Solo en mantenimiento, nunca al aire. Se crea un respaldo previo.</p>
        <label className="text-xs text-slate-300 block">Escribe RESTAURAR para continuar
          <input className="block mt-2 w-full sm:w-64 bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-white" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="RESTAURAR"/>
        </label>
        <button className="rounded-xl px-4 py-2 border border-amber-500/40 bg-amber-600/20 text-amber-200 text-sm font-bold disabled:opacity-40 flex items-center gap-2" onClick={()=>void execute('restore')} disabled={busy || obsStatus.connected || obsStatus.virtualCamActive || confirmText!=='RESTAURAR'}><ArchiveRestore size={16}/> Restaurar (solo fuera de emisión)</button>
      </div>}
      {notice && <div role="status" className="text-sm text-emerald-300 flex gap-3 items-center"><span>{notice}</span>{notice.startsWith('Restauración') && <button className="text-[#FF8A3C] underline" onClick={()=>window.location.reload()}>Recargar ahora</button>}</div>}
      {fault && <p role="alert" className="text-sm text-rose-300">{fault}</p>}
    </div>
  </div>;
}
