/** Client for local-only recovery endpoints; never submits OBS credentials. */
export interface BackupItem {
  id: string;
  createdAt: string;
  totalBytes: number;
  files: { path: string; size: number; sha256: string }[];
}
export interface DiagnosticCheck { id: string; ok: boolean; description: string }
export interface RecoverySnapshot {
  backups: BackupItem[];
  diagnostics: { version: string; timestamp: string; checks: DiagnosticCheck[] };
}
async function jsonResponse<T>(r: Response): Promise<T> {
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || `Operación no disponible (${r.status})`);
  return value;
}
export const recoveryService = {
  async check(): Promise<RecoverySnapshot> {
    return jsonResponse(await fetch('/api/station/recovery', { cache: 'no-store' }));
  },
  async backup(): Promise<void> {
    await jsonResponse(await fetch('/api/station/recovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create' }),
    }));
  },
  async restore(id: string): Promise<void> {
    await jsonResponse(await fetch('/api/station/recovery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', id, confirm: 'RESTAURAR' }),
    }));
  },
};
