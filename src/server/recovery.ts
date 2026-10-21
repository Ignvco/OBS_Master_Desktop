/**
 * Portable release backups. No tokens, credentials, or OBS WebSocket passwords.
 * Backups are explicit (never block the broadcast loop on a background copy).
 */
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {validStudioPreset,MAX_STUDIO_PRESETS} from '../utils/studioPresets.ts';

export const BACKUP_LIMIT_BYTES = 512 * 1024 * 1024;
export const MAX_BACKUPS = 5;
const BACKUP_ID = /^\d{13}-[0-9a-f]{8}$/;
const ROOT_FILES = ['station.json', 'library.json', 'studio-presets.json'];
const MEDIA_FOLDERS = ['media', 'assets'];

type BackupFile = { path: string; size: number; sha256: string };
export type BackupManifest = {
  id: string; createdAt: string; format: 1; files: BackupFile[]; totalBytes: number;
};

function safePath(root: string, target: string) {
  const absRoot = resolve(root);
  const absTarget = resolve(absRoot, target);
  if (absTarget !== absRoot && !absTarget.startsWith(absRoot + sep)) throw new Error('Ruta no permitida');
  return absTarget;
}
function isSafeId(id: string): boolean { return BACKUP_ID.test(id); }
async function digest(file: string): Promise<string> {
  return new Promise((done, fail) => {
    const h = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk: string | Buffer) => {
      h.update(chunk);
    });
    stream.on('error', fail);
    stream.on('end', () => done(h.digest('hex')));
  });
}
async function discover(dataDir: string): Promise<string[]> {
  const found: string[] = [];
  for (const f of ROOT_FILES) {
    try { if ((await lstat(join(dataDir, f))).isFile()) found.push(f); } catch (err: any) { if (err.code !== 'ENOENT') throw err; }
  }
  for (const folder of MEDIA_FOLDERS) {
    const root = join(dataDir, folder);
    let items: string[];
    try { items = await readdir(root); } catch (err: any) { if (err.code === 'ENOENT') continue; throw err; }
    for (const item of items) {
      // Existing media-store only uses flat asset files; no symlinks or nested directories.
      const rel = `${folder}/${item}`;
      if ((await lstat(safePath(dataDir, rel))).isFile()) found.push(rel);
    }
  }
  return found;
}
export async function listBackups(dataDir: string): Promise<BackupManifest[]> {
  const root = join(dataDir, 'backups');
  let entries: string[];
  try { entries = await readdir(root); } catch (e: any) { if (e.code === 'ENOENT') return []; throw e; }
  const manifests: BackupManifest[] = [];
  for (const entry of entries.filter(isSafeId)) {
    try {
      const manifest = JSON.parse(await readFile(join(root, entry, 'manifest.json'), 'utf8'));
      if (validManifest(manifest) && manifest.id === entry) manifests.push(manifest);
    } catch { /* Ignore incomplete/invalid backups; never offer restoration. */ }
  }
  return manifests.sort((a, b) => b.id.localeCompare(a.id));
}
function validManifest(value: unknown): value is BackupManifest {
  const v = value as BackupManifest;
  return !!v && v.format === 1 && typeof v.id === 'string' && isSafeId(v.id)
    && Array.isArray(v.files) && Number.isFinite(v.totalBytes) && v.totalBytes >= 0
    && new Set(v.files.map(f => f?.path)).size === v.files.length
    && v.files.reduce((sum, f) => sum + (Number.isInteger(f?.size) ? f.size : 0), 0) === v.totalBytes
    && v.files.every(f => f && typeof f.path === 'string'
      && (ROOT_FILES.includes(f.path) || MEDIA_FOLDERS.some(d => f.path.startsWith(d + '/')))
      && !f.path.includes('..') && !f.path.includes('\\') && f.path.split('/').length <= 2
      && Number.isInteger(f.size) && f.size >= 0 && /^[a-f0-9]{64}$/.test(f.sha256));
}
export async function createBackup(dataDir: string, preserveId = ''): Promise<BackupManifest> {
  const root = resolve(dataDir);
  const backupsDir = join(root, 'backups');
  await mkdir(backupsDir, { recursive: true });
  const files = await discover(root);
  let bytes = 0;
  for (const filename of files) {
    bytes += (await stat(safePath(root, filename))).size;
    if (bytes > BACKUP_LIMIT_BYTES) throw new Error('Los recursos superan 512 MB. Exporta tus videos grandes por separado antes del respaldo.');
  }
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const staging = join(backupsDir, `.creating-${id}`);
  const target = join(backupsDir, id);
  await mkdir(staging);
  try {
    const backed: BackupFile[] = [];
    for (const filename of files) {
      const destination = safePath(staging, filename);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(safePath(root, filename), destination);
      const info = await stat(destination);
      backed.push({ path: filename, size: info.size, sha256: await digest(destination) });
    }
    const manifest: BackupManifest = {
      id, createdAt: new Date().toISOString(), format: 1, files: backed,
      totalBytes: backed.reduce((sum, f) => sum + f.size, 0),
    };
    await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    await rename(staging, target);
    const saved = await listBackups(root);
    const unprotected = saved.filter(b => b.id !== preserveId);
    for (const old of unprotected.slice(MAX_BACKUPS - (preserveId ? 1 : 0))) {
      await rm(join(backupsDir, old.id), { recursive: true, force: true });
    }
    return manifest;
  } catch (err) { await rm(staging, { recursive: true, force: true }); throw err; }
}
export async function restoreBackup(dataDir: string, id: string): Promise<{ restored: string[]; safetyBackup: string }> {
  if (!isSafeId(id)) throw new Error('Identificador de respaldo inválido');
  const source = join(resolve(dataDir), 'backups', id);
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
  if (!validManifest(manifest) || manifest.id !== id) throw new Error('El manifiesto del respaldo es inválido');
  // Preset-only backups from older releases are still accepted.
  // Verify *every* asset before overwriting anything.
  for (const file of manifest.files) {
    const saved = safePath(source, file.path);
    const info = await lstat(saved);
    if (!info.isFile() || info.size !== file.size || await digest(saved) !== file.sha256) {
      throw new Error(`Respaldo alterado o incompleto: ${basename(file.path)}`);
    }
    if (ROOT_FILES.includes(file.path)) {
      try {
        const parsed = JSON.parse(await readFile(saved, 'utf8'));
        if (file.path === 'studio-presets.json') {
          if (!Array.isArray(parsed) || parsed.length > MAX_STUDIO_PRESETS || !parsed.every(validStudioPreset)) throw new Error('Biblioteca de estilos inválida');
        } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('No es objeto');
      } catch { throw new Error(`Los metadatos del respaldo no son JSON válido: ${file.path}`); }
    }
  }
  // A non-destructive recovery point is created first, even when manually restoring.
  const safety = await createBackup(dataDir, id);
  // Overwrite backed-up files; retain unrelated new files instead of deleting user media.
  const ordered = [...manifest.files].sort((a, b) => Number(ROOT_FILES.includes(a.path)) - Number(ROOT_FILES.includes(b.path)));
  for (const file of ordered) {
    const to = safePath(dataDir, file.path);
    await mkdir(dirname(to), { recursive: true });
    const temp = `${to}.restore-tmp`;
    await copyFile(safePath(source, file.path), temp);
    if (file.path === 'station.json') {
      // Restored designs and drafts are preserved, but the old on-air flag is
      // never replayed as if OBS had confirmed visibility in this new session.
      const restoredStation = JSON.parse(await readFile(temp, 'utf8')) as Record<string, unknown>;
      for (const key of ['components', 'customComponents']) {
        const registry = restoredStation[key];
        if (registry && typeof registry === 'object' && !Array.isArray(registry)) {
          for (const graphic of Object.values(registry as Record<string, any>)) {
            if (graphic && typeof graphic === 'object') graphic.visibleInOBS = false;
          }
        }
      }
      await writeFile(temp, JSON.stringify(restoredStation), { mode: 0o600 });
    }
    await rename(temp, to);
  }
  return { restored: manifest.files.map(f => f.path), safetyBackup: safety.id };
}
export async function inspectRuntime(dataDir: string) {
  const results: { id: string; ok: boolean; description: string }[] = [];
  for (const filename of ROOT_FILES) {
    try {
      const content = await readFile(join(dataDir, filename), 'utf8');
      const value = JSON.parse(content);
      results.push({ id: filename, ok: !!value && typeof value === 'object', description: 'Archivo JSON legible' });
    } catch (e: any) {
      results.push({ id: filename, ok: e.code === 'ENOENT', description: e.code === 'ENOENT' ? 'Aún no se ha creado' : 'No se pudo leer/analizar el JSON' });
    }
  }
  try {
    await mkdir(dataDir, { recursive: true });
    const marker = join(dataDir, `.write-test-${randomBytes(4).toString('hex')}`);
    await writeFile(marker, 'ok', { flag: 'wx', mode: 0o600 });
    await rm(marker);
    results.push({ id: 'writable', ok: true, description: 'AppData permite guardar datos' });
  } catch { results.push({ id: 'writable', ok: false, description: 'AppData no permite escritura' }); }
  return { version: '4.1.0-rc.1', checks: results, timestamp: new Date().toISOString() };
}
