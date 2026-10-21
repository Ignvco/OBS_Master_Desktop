/**
 * Local-only shared state bridge for OBS Browser Sources.
 * Vite dev and preview load the same persisted snapshot. Does not contain OBS credentials.
 */
import type { Plugin } from 'vite';
import { isCustomRegistry } from '../utils/componentRegistry.ts';
import { MAX_LOGO_BYTES, readLogo, storeLogo } from './logoAsset.ts';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATA_DIRECTORY } from './runtimePaths.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { libraryWithStatus, mutateLibrary } from './libraryStore.ts';
import { deleteMediaFile, mediaFile, serveMedia, uploadMedia, MAX_MEDIA_BYTES } from './mediaStore.ts';
import { createBackup, listBackups, restoreBackup, inspectRuntime } from './recovery.ts';
import { resetLibraryCache } from './libraryStore.ts';
import {readStudioPresets,mutateStudioPresets} from './studioPresetsStore.ts';
import {applyPublication,saveRevision,restoreRevisionToDraft,manageRevision, operationalOnlyPatch} from '../utils/publicationEngine.ts';
import type {EditorialComponentConfig} from '../types/index.ts';
import type {PublicationDocument} from '../utils/publicationEngine.ts';
import {getDirectPreview,saveDirectPreview} from './directPreviewStore.ts';

const FIELDS = new Set(['episode', 'components', 'customComponents', 'draftComponents', 'draftCustomComponents', 'countdown']);
const FILE = resolve(DATA_DIRECTORY, 'station.json');
let cached: Record<string, unknown> | null = null;
const subscribers = new Set<ServerResponse>();
let nativeTakeBusy = false;

/** Exclusive on-air transaction: UI/station changes cannot race the video engine. */
export function beginNativeTake(expectedRevision:number):{revision:number;ids:string[]} {
  if(nativeTakeBusy)throw new Error('Ya hay una transición en curso');
  if(recoveryBusy)throw new Error('La estación está en mantenimiento');
  const preview=getDirectPreview();
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==preview.revision)
    throw new Error('La composición Preview cambió; actualiza antes de llevarla al aire');
  const published=load();
  if(!published||!published.components)throw new Error('No existe un catálogo publicado');
  const known=new Set([
    ...Object.keys(published.components as Record<string,unknown>),
    ...Object.keys((published.customComponents??{}) as Record<string,unknown>),
  ]);
  if(preview.ids.some(id=>!known.has(id)))throw new Error('Preview contiene una gráfica no publicada');
  nativeTakeBusy=true;
  return {revision:preview.revision,ids:[...preview.ids]};
}
export function commitNativeTake(ids:string[],revision:number,takeId:string) {
  if(!nativeTakeBusy)throw new Error('No hay transición activa');
  if(!/^[0-9a-f]{32}$/.test(takeId))throw new Error('ID de transición inválido');
  const current=getDirectPreview();
  if(current.revision!==revision||JSON.stringify(current.ids)!==JSON.stringify(ids))
    throw new Error('La selección de Preview cambió durante la transición');
  const before=load();
  if(!before||!before.components)throw new Error('El catálogo de Program ya no está disponible');
  const selected=new Set(ids);
  const activate=(registry:Record<string,EditorialComponentConfig>)=>
    Object.fromEntries(Object.entries(registry).map(([id,config])=>[
      id,config.visibleInOBS===selected.has(id)?config:{...config,visibleInOBS:selected.has(id)}
    ]));
  const published=activate(before.components as Record<string,EditorialComponentConfig>);
  const custom=activate((before.customComponents??{}) as Record<string,EditorialComponentConfig>);
  const next={...before,components:published,customComponents:custom,directTakeId:takeId};
  // Do not modify drafts, history, or versions. Publish all operational flags once.
  save(next);
}
export function releaseNativeTake(){nativeTakeBusy=false;}

/** Never send drafts or publication history into the OBS Browser Source stream. */
function broadcastSnapshot(state: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!state) return null;
  return Object.fromEntries(['components','customComponents','countdown','directTakeId'].filter(key=>key in state).map(key=>[key,state[key]]));
}

function load(): Record<string, unknown> | null {
  if (cached) return cached;
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) cached = raw;
  } catch { /* First launch, no state yet */ }
  return cached;
}
function save(next: Record<string, unknown>, notifyBroadcast = true) {
  mkdirSync(dirname(FILE), { recursive: true });
  const temp = FILE + '.tmp';
  writeFileSync(temp, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  renameSync(temp, FILE);
  cached = next;
  if (notifyBroadcast) {
    const message = `event: update\ndata: ${JSON.stringify(broadcastSnapshot(next))}\n\n`;
    for (const client of subscribers) {
      try { client.write(message); } catch { subscribers.delete(client); }
    }
  }
}
export function reloadStateAfterRestore() {
  cached = null;
  const message = `event: update\ndata: ${JSON.stringify(broadcastSnapshot(load()))}\n\n`;
  for (const client of subscribers) { try { client.write(message); } catch { subscribers.delete(client); } }
}
let recoveryBusy = false;
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function safeOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // Browser source can omit Origin for same-origin requests.
  try {
    const url = new URL(origin);
    return url.host === host && ['http:', 'https:'].includes(url.protocol);
  } catch { return false; }
}
function validPatch(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const entries = Object.entries(payload);
  if (!entries.length || entries.some(([k, v]) => !FIELDS.has(k) || !v || typeof v !== 'object' || Array.isArray(v))) return false;
  const obj = payload as Record<string, unknown>;
  if (obj.episode && (typeof (obj.episode as any).title !== 'string' || !Array.isArray((obj.episode as any).rundown))) return false;
  if (obj.components && !Object.values(obj.components).every(v => v && typeof v === 'object')) return false;
  if (obj.customComponents && !isCustomRegistry(obj.customComponents)) return false;
  if (obj.draftComponents && !Object.values(obj.draftComponents).every(v => v && typeof v === 'object' && !Array.isArray(v))) return false;
  if (obj.draftCustomComponents && !isCustomRegistry(obj.draftCustomComponents)) return false;
  if (obj.countdown && (typeof (obj.countdown as any).remainingSeconds !== 'number' || typeof (obj.countdown as any).isRunning !== 'boolean')) return false;
  return true;
}
export function stationMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const route = req.url?.split('?')[0];
  // Maintenance is an exclusive transaction: an autosave, publication, or media
  // mutation must not interleave with a restore and silently overwrite its files.
  // Read-only health/stream requests remain usable during maintenance.
  if ((recoveryBusy || nativeTakeBusy) && route?.startsWith('/api/station/') && req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 423, { error: 'Estación en mantenimiento: espera a que finalice el respaldo o la restauración antes de guardar o publicar.' });
    return;
  }
  if (route === '/api/direct/preview') {
    if (!safeOrigin(req)) { json(res,403,{error:'Origen local requerido'});return; }
    if (nativeTakeBusy && req.method!=='GET') {json(res,423,{error:'Preview protegido durante la transición'});return;}
    if (req.method==='GET') {json(res,200,{preview:getDirectPreview()});return;}
    if (req.method!=='POST') {json(res,405,{error:'Método no permitido'});return;}
    const origin=req.headers.origin;
    if(!origin){json(res,403,{error:'Se requiere origen del panel'});return;}
    if(!String(req.headers['content-type']??'').startsWith('application/json')){
      json(res,415,{error:'Solo se admite JSON'});return;
    }
    let body='';let tooLarge=false;
    req.on('data',chunk=>{body+=chunk.toString('utf8');if(body.length>4096){tooLarge=true;body='';}});
    req.on('end',()=>{
      if(tooLarge){json(res,413,{error:'Selección demasiado grande'});return;}
      try{
        const action=JSON.parse(body);
        if(!action||!Array.isArray(action.ids)||!Number.isSafeInteger(action.expectedRevision))throw new Error('Comando Preview inválido');
        const station=load()??{};
        const ids=new Set([
          ...Object.keys((station.components??{}) as Record<string,unknown>),
          ...Object.keys((station.customComponents??{}) as Record<string,unknown>),
        ]);
        const preview=saveDirectPreview(action.ids,ids,action.expectedRevision);
        json(res,200,{preview});
      }catch(error){
        json(res,409,{error:error instanceof Error?error.message:'No se pudo preparar Preview'});
      }
    });
    return;
  }
  if (route === '/api/station/publications') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method === 'GET') {
      const state = load() ?? {};
      json(res, 200, { history: state.publicationHistory ?? {} });
      return;
    }
    if (req.method !== 'POST') { json(res, 405, { error: 'Método no permitido' }); return; }
    let body = ''; let oversized = false;
    req.on('data', chunk => { body += chunk.toString('utf8'); if (body.length > 2500) oversized = true; });
    req.on('end', () => {
      if (oversized) { json(res, 413, { error: 'Operación demasiado grande' }); return; }
      try {
        const action = JSON.parse(body);
        if (!action || !['publish','save','restore-draft','rename','remove','pin'].includes(action.action) || typeof action.id !== 'string'
            || !/^(banner|lower-third|chapter|section|question|quote|scripture|social|social-pill|logo-bug|ticker|editorial|waiting|break|outro|gfx-[a-f0-9]{24,32})$/.test(action.id))
          throw new Error('Gráfica o acción inválida');
        if (action.action === 'publish' && action.confirm !== 'PUBLICAR') throw new Error('Confirma la publicación');
        if (action.action === 'remove' && action.confirm !== 'ELIMINAR') throw new Error('Confirma la eliminación');
        if (['restore-draft','rename','remove','pin'].includes(action.action) && (!Number.isInteger(action.version) || action.version < 0))
          throw new Error('Selecciona una versión válida');
        const old = load() ?? {};
        let state: PublicationDocument;
        if(action.action==='publish') state=applyPublication(old as PublicationDocument,action.id);
        else if(action.action==='save') state=saveRevision(old as PublicationDocument,action.id,action.label??'');
        else if(action.action==='restore-draft') state=restoreRevisionToDraft(old as PublicationDocument,action.id,action.version);
        else state=manageRevision(old as PublicationDocument,action.id,action.version,action.action,action.label);
        save(state as Record<string,unknown>);
        const timeline=state.publicationHistory?.[action.id];
        json(res,200,{ok:true,history:timeline??null,published:action.action==='publish'?(
          action.id.startsWith('gfx-')?state.customComponents?.[action.id]:state.components?.[action.id as keyof typeof state.components]):undefined,
          draft:action.action==='restore-draft'?(
          action.id.startsWith('gfx-')?state.draftCustomComponents?.[action.id]:state.draftComponents?.[action.id as keyof typeof state.draftComponents]):undefined});
      } catch (err: any) { json(res, 409, { error: err.message || 'Publicación rechazada' }); }
    });
    return;
  }
  if (route === '/api/station/recovery') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method === 'GET') {
      void Promise.all([listBackups(DATA_DIRECTORY), inspectRuntime(DATA_DIRECTORY)])
        .then(([backups, diagnostics]) => json(res, 200, { backups, diagnostics }))
        .catch((err: Error) => json(res, 500, { error: err.message }));
      return;
    }
    if (req.method !== 'POST') { json(res, 405, { error: 'Método no permitido' }); return; }
    let body = ''; let oversized = false;
    req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); if (body.length > 4096) oversized = true; });
    req.on('end', () => {
      if (oversized) { json(res, 413, { error: 'Solicitud demasiado grande' }); return; }
      if (recoveryBusy) { json(res, 409, { error: 'Ya hay una operación de recuperación en curso' }); return; }
      let action: any;
      try { action = JSON.parse(body); }
      catch { json(res, 400, { error: 'JSON inválido' }); return; }
      if (!action || !['create', 'restore'].includes(action.action)) { json(res, 400, { error: 'Acción inválida' }); return; }
      if (action.action === 'restore' && (action.confirm !== 'RESTAURAR' || typeof action.id !== 'string')) {
        json(res, 400, { error: 'Restauración sin confirmación explícita' }); return;
      }
      if (action.action === 'restore') {
        const current = load() ?? {};
        const onAir = [...Object.values((current.components ?? {}) as Record<string, { visibleInOBS?: boolean }>),
          ...Object.values((current.customComponents ?? {}) as Record<string, { visibleInOBS?: boolean }>)]
          .some(graphic => graphic?.visibleInOBS);
        if (onAir) { json(res, 409, {error:'Retira todas las gráficas del aire antes de restaurar un respaldo de la estación.'}); return; }
      }
      recoveryBusy = true;
      void (async () => {
        try {
          const result = action.action === 'create'
            ? { backup: await createBackup(DATA_DIRECTORY) }
            : { restoration: await restoreBackup(DATA_DIRECTORY, action.id) };
          if (action.action === 'restore') { resetLibraryCache(); reloadStateAfterRestore(); }
          json(res, 200, { ok: true, ...result });
        } catch (err: any) { json(res, 422, { error: err.message || 'No se pudo ejecutar la operación' }); }
        finally { recoveryBusy = false; }
      })();
    });
    return;
  }
  if (route === '/api/station/studio-presets') {
    if (!safeOrigin(req)) { json(res, 403, {error:'Origen no autorizado'}); return; }
    if (req.method === 'GET') {
      try {json(res,200,{presets:readStudioPresets()});}
      catch(e:any){json(res,500,{error:e.message||'No se pudieron leer los estilos'});}
      return;
    }
    if (req.method !== 'POST') {json(res,405,{error:'Método no permitido'});return;}
    let body='';let oversized=false;
    req.on('data',(chunk:Buffer)=>{body+=chunk.toString('utf8');if(body.length>250_000){oversized=true;body='';}});
    req.on('end',()=>{
      if(oversized){json(res,413,{error:'El estilo supera el límite permitido'});return;}
      try{json(res,200,{presets:mutateStudioPresets(JSON.parse(body))});}
      catch(e:any){json(res,400,{error:e.message||'No se pudo guardar el estilo'});}
    });
    return;
  }
  if (route === '/api/station/library') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method === 'GET') { json(res, 200, { library: libraryWithStatus() }); return; }
    if (req.method !== 'POST') { json(res, 405, { error: 'Método no permitido' }); return; }
    let body = ''; let oversized = false;
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
      if (body.length > 3_000_000) { body = ''; oversized = true; }
    });
    req.on('end', () => {
      if (oversized) { json(res, 413, { error: 'Catálogo demasiado grande' }); return; }
      try {
        const action = JSON.parse(body);
        json(res, 200, { library: mutateLibrary(action) });
      } catch (err: any) { json(res, 400, { error: err.message || 'Solicitud inválida' }); }
    });
    return;
  }
  if (route === '/api/station/media' && req.method === 'POST') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    const contentLength = Number(req.headers['content-length']);
    if (contentLength > MAX_MEDIA_BYTES) { json(res, 413, { error: 'Máximo 150 MB por recurso' }); return; }
    void (async () => {
      try {
        const asset = await uploadMedia(req);
        try {
          const library = mutateLibrary({ action: 'asset.save', asset });
          json(res, 201, { asset, library });
        } catch (err) {
          await deleteMediaFile(asset.url).catch(() => undefined);
          throw err;
        }
      } catch (err: any) { if (!res.headersSent && !res.destroyed) json(res, 422, { error: err.message || 'No se pudo subir el recurso' }); }
    })();
    return;
  }
  if (route?.startsWith('/api/station/media/')) {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { error: 'Método no permitido' }); return; }
    serveMedia(req, res, route.slice('/api/station/media/'.length));
    return;
  }
  if (route === '/api/station/media-delete' && req.method === 'POST') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); if (body.length > 1024) body = 'INVALID'; });
    req.on('end', () => {
      void (async () => {
        try {
          const { id } = JSON.parse(body);
          if (typeof id !== 'string') throw new Error('Recurso inválido');
          const asset = libraryWithStatus().assets.find(a => a.id === id);
          if (!asset) throw new Error('Recurso no encontrado');
          await deleteMediaFile(asset.url);
          const library = mutateLibrary({ action: 'asset.delete', id });
          json(res, 200, { library });
        } catch (err: any) { if (!res.headersSent) json(res, 400, { error: err.message || 'Error al eliminar' }); }
      })();
    });
    return;
  }
  if (route === '/api/station/assets/logo') {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method !== 'POST') { json(res, 405, { error: 'Método no permitido' }); return; }
    const declaredType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(declaredType)) {
      json(res, 415, { error: 'Sube una imagen PNG, JPG o WebP.' }); return;
    }
    const expectedSize = Number(req.headers['content-length']);
    if (Number.isFinite(expectedSize) && expectedSize > MAX_LOGO_BYTES) {
      json(res, 413, { error: 'Logo demasiado grande (máx. 4 MB).' }); return;
    }
    const parts: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_LOGO_BYTES) { oversized = true; return; }
      parts.push(chunk);
    });
    req.on('end', () => {
      if (oversized) { json(res, 413, { error: 'Logo demasiado grande (máx. 4 MB).' }); return; }
      try { const url = storeLogo(Buffer.concat(parts), declaredType); json(res, 201, { url }); }
      catch (err: any) { json(res, 422, { error: err.message || 'Logo inválido' }); }
    });
    return;
  }
  if (route?.startsWith('/api/station/assets/')) {
    if (!safeOrigin(req)) { json(res, 403, { error: 'Origen no autorizado' }); return; }
    if (req.method !== 'GET') { json(res, 405, { error: 'Método no permitido' }); return; }
    const file = readLogo(route.slice('/api/station/assets/'.length));
    if (!file) { json(res, 404, { error: 'Imagen no encontrada' }); return; }
    res.writeHead(200, { 'Content-Type': file.mime, 'Content-Length': file.bytes.length,
      'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.end(file.bytes);
    return;
  }
  if (route !== '/api/station/state' && route !== '/api/station/events') { next(); return; }
  if (!safeOrigin(req)) { json(res, 403, { error: 'Solo se permite origen local.' }); return; }
  if (route === '/api/station/events') {
    if (req.method !== 'GET') { json(res, 405, { error: 'Método no permitido' }); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': conectado\n\n');
    const state = load();
    if (state) res.write(`event: update\ndata: ${JSON.stringify(broadcastSnapshot(state))}\n\n`);
    subscribers.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
    req.on('close', () => { clearInterval(ping); subscribers.delete(res); });
    return;
  }
  if (req.method === 'GET') { json(res, 200, { state: load() }); return; }
  if (req.method !== 'PATCH') { json(res, 405, { error: 'Método no permitido' }); return; }
  let body = '';
  let tooLarge = false;
  req.on('data', chunk => {
    if (tooLarge) return;
    body += chunk.toString('utf8');
    if (body.length > 2_000_000) { tooLarge = true; body = ''; }
  });
  req.on('end', () => {
    if (tooLarge) { json(res, 413, { error: 'Estado demasiado grande' }); return; }
    try {
      const patch = JSON.parse(body);
      if (!validPatch(patch)) { json(res, 400, { error: 'Estado inválido' }); return; }
      const previous = load();
      // Already-running stations accept ONLY operational changes to on-air records.
      // Visual edits must use draft* fields and an explicit publication transaction.
      if (previous && patch.components && !operationalOnlyPatch(previous.components as Record<string, EditorialComponentConfig> | undefined,
        patch.components as Record<string, EditorialComponentConfig>)) {
        json(res, 409, { error: 'No se permite cambiar diseños publicados mediante sincronización directa. Usa Publicar.' }); return;
      }
      if (previous && patch.customComponents && !operationalOnlyPatch((previous.customComponents ?? {}) as Record<string, EditorialComponentConfig>,
        patch.customComponents as Record<string, EditorialComponentConfig>)) {
        json(res, 409, { error: 'No se permite cambiar gráficas publicadas mediante sincronización directa. Usa Publicar.' }); return;
      }
      const newState = { ...(previous || {}), ...patch };
      save(newState, Boolean(patch.components || patch.customComponents || patch.countdown));
      json(res, 200, { ok: true });
    } catch { if (!res.headersSent) json(res, 400, { error: 'JSON inválido' }); }
  });
}
export function stationBridge(): Plugin {
  return {
    name: 'stdq-station-bridge',
    configureServer(server) { server.middlewares.use(stationMiddleware); },
    configurePreviewServer(server) { server.middlewares.use(stationMiddleware); },
  };
}
