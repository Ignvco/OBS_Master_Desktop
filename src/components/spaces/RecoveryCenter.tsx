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
  return <div className="space-y-4 max-w-5xl">
    <div className="atem-module overflow-hidden">
      <div className="atem-module-header">
        <span className="atem-label text-[#E6E9EF] flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#E58A1F]"/> RECOVERY CENTER · DIAGNÓSTICO DE ESTACIÓN</span>
        <button onClick={()=>void refresh()} disabled={busy} className="atem-btn px-3 py-1 text-[10px] font-bold text-[#E6E9EF] disabled:opacity-40 inline-flex gap-1.5 items-center"><RefreshCw size={12}/> Actualizar diagnóstico</button>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-[#8E95A3] text-xs">Diagnóstico de integridad y respaldos de producción verificados con SHA-256. Sin contraseñas WebSocket.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className="atem-readout p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">OBS WebSocket</p><p className={`font-mono text-xs font-bold mt-1.5 ${obsStatus.connected?'text-[#00C853]':'text-[#E58A1F]'}`}>{obsStatus.connected?'CONECTADO':'DESCONECTADO'}</p></div>
          <div className="atem-readout p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Cámara virtual</p><p className={`font-mono text-xs font-bold mt-1.5 ${obsStatus.virtualCamActive?'text-[#D91F26]':'text-[#8E95A3]'}`}>{obsStatus.virtualCamActive?'ACTIVA (AL AIRE)':'INACTIVA'}</p></div>
          <div className="atem-readout p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8E95A3]">Respaldos disponibles</p><p className="font-mono text-xs font-bold mt-1.5 text-white">{snapshot?.backups.length ?? '—'}</p></div>
        </div>
        <div className="space-y-1.5 atem-well p-3">
          {snapshot?.diagnostics.checks.map(item => <div key={item.id} className="flex items-center gap-2 text-xs"><FileCheck2 size={14} className={item.ok?'text-[#00C853]':'text-[#D91F26]'}/><span className="font-mono font-bold text-white">{item.id}</span><span className="text-[#8E95A3]">— {item.description}</span></div>)}
        </div>
        <button onClick={exportReport} disabled={!snapshot} className="atem-btn px-3 py-1.5 text-[11px] font-bold text-[#FFC078] disabled:opacity-50">Exportar diagnóstico (sin secretos)</button>
      </div>
    </div>
    <div className="atem-module overflow-hidden">
      <div className="atem-module-header">
        <span className="atem-label text-[#E6E9EF] flex items-center gap-1.5"><DatabaseBackup className="text-[#E58A1F]" size={14}/> PUNTOS DE RECUPERACIÓN EN DISCO</span>
        <button disabled={busy || obsStatus.virtualCamActive} onClick={()=>void execute('backup')} className="atem-btn atem-btn-amber px-3 py-1 text-[#FFC078] font-bold text-[10px] disabled:opacity-50 inline-flex items-center gap-1.5"><HardDriveDownload size={13}/> Crear respaldo</button>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-[#8E95A3]">Hasta 5 copias locales de Biblioteca, gráficas, imágenes y medios (máx. 512 MB por respaldo). Crea respaldos antes o después de emitir.</p>
        {snapshot?.backups.length ? <div className="space-y-2">
          {snapshot.backups.map(b => <label key={b.id} className={`flex gap-3 items-center p-3 rounded border cursor-pointer ${selection===b.id?'border-[#E58A1F] bg-[#E58A1F]/10':'border-[#2C313C] bg-[#0B0D10]'}`}>
            <input type="radio" name="recovery-backup" checked={selection===b.id} onChange={()=>{setSelection(b.id);setConfirmText('');}}/>
            <div className="flex-1"><p className="font-mono font-bold text-xs text-white">{new Date(b.createdAt).toLocaleString('es-CL')}</p><p className="font-mono text-[10px] text-[#8E95A3]">{b.files.length} archivos · {(b.totalBytes/1024/1024).toFixed(1)} MB</p></div>
          </label>)}
        </div> : <p className="text-xs text-[#58606E]">Todavía no hay puntos de recuperación.</p>}
        {selection && <div className="border border-[#E58A1F]/40 rounded bg-[#E58A1F]/10 p-3.5 space-y-3">
          <p className="text-xs text-[#FFC078] flex items-center gap-2"><AlertTriangle size={15}/> Restaurar reemplaza el estado guardado. Solo en mantenimiento, nunca al aire. Se crea un respaldo previo.</p>
          <label className="text-[11px] font-bold text-[#E6E9EF] block">Escribe RESTAURAR para continuar
            <input className="block mt-1.5 w-full sm:w-64 bg-[#0B0D10] border border-[#2C313C] rounded px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-[#E58A1F]" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="RESTAURAR"/>
          </label>
          <button className="atem-btn atem-btn-amber px-3.5 py-1.5 text-[#FFC078] text-xs font-bold disabled:opacity-40 inline-flex items-center gap-2" onClick={()=>void execute('restore')} disabled={busy || obsStatus.connected || obsStatus.virtualCamActive || confirmText!=='RESTAURAR'}><ArchiveRestore size={14}/> Restaurar (solo fuera de emisión)</button>
        </div>}
        {notice && <div role="status" className="text-xs text-[#69F0AE] flex gap-3 items-center"><span>{notice}</span>{notice.startsWith('Restauración') && <button className="text-[#FFC078] underline font-bold" onClick={()=>window.location.reload()}>Recargar ahora</button>}</div>}
        {fault && <p role="alert" className="text-xs text-[#FF8A80]">{fault}</p>}
      </div>
    </div>
  </div>;
}
