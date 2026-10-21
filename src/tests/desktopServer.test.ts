import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = mkdtempSync(join(tmpdir(), 'stdq-desktop-test-'));
const staticDir = join(temp, 'dist');
const persistentDir = join(temp, 'user-data');
mkdirSync(join(staticDir, 'assets'), { recursive:true });
writeFileSync(join(staticDir,'index.html'), '<title>ESTACION</title>');
writeFileSync(join(staticDir,'assets','runtime.js'), 'console.log("test")');
process.env.STDQ_DATA_DIR = persistentDir;
process.env.STDQ_STATIC_DIR = staticDir;
const { createStationHandler } = await import('../../desktop-app/server.ts');
const server = createServer(createStationHandler(staticDir));
await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
const host = server.address();
const base = `http://127.0.0.1:${typeof host === 'object' && host ? host.port : 0}`;

test('desktop sirve React compilado, overlay y assets locales',async()=>{
  const root = await fetch(base+'/');
  assert.equal(root.status,200);
  assert.match(await root.text(),/ESTACION/);
  const overlay=await fetch(base+'/?overlay=ticker');
  assert.equal(overlay.status,200);
  const asset=await fetch(base+'/assets/runtime.js');
  assert.equal(asset.status,200);
  assert.match(await asset.text(),/console\.log/);
  const missing=await fetch(base+'/assets/absent.js');
  assert.equal(missing.status,404);
});

test('servidor desktop conserva rutas y guarda en directorio de usuario', async()=>{
  const health=await (await fetch(base+'/api/station/health')).json();
  assert.equal(health.ok,true);
  assert.equal(health.mode,'desktop');
  const state={countdown:{isRunning:false,remainingSeconds:15,durationSeconds:15}};
  const patch=await fetch(base+'/api/station/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
  assert.equal(patch.status,200);
  assert.equal(existsSync(join(persistentDir,'station.json')),true);
  assert.equal(JSON.parse(readFileSync(join(persistentDir,'station.json'),'utf8')).countdown.remainingSeconds,15);
});

test('desktop rechaza orígenes externos y rutas inseguras',async()=>{
  const foreign=await fetch(base+'/api/station/state',{method:'PATCH',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'});
  assert.equal(foreign.status,403);
  const missing=await fetch(base+'/api/otro');
  assert.equal(missing.status,404);
  const traversal=await fetch(base+'/%5Cwindows');
  assert.equal(traversal.status,400);
});

test('desktop recovery permite diagnóstico y respaldo; rechaza origen externo y restauración sin confirmación', async () => {
  const remote = await fetch(base + '/api/station/recovery', { headers: { Origin:'https://externo.test' } });
  assert.equal(remote.status, 403);
  const status = await (await fetch(base + '/api/station/recovery')).json();
  assert.equal(status.diagnostics.checks.find((x: any) => x.id === 'writable')?.ok, true);
  const create = await fetch(base + '/api/station/recovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'create' }) });
  assert.equal(create.status, 200);
  const { backup } = await create.json();
  assert.ok(backup.id);
  const rejected = await fetch(base + '/api/station/recovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'restore', id:backup.id})});
  assert.equal(rejected.status, 400);
  const restored = await fetch(base + '/api/station/recovery', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'restore', id:backup.id, confirm:'RESTAURAR' }) });
  assert.equal(restored.status, 200);
});

test.after(async()=>{
  await new Promise<void>(r=>server.close(()=>r()));
  rmSync(temp,{recursive:true,force:true});
  delete process.env.STDQ_DATA_DIR;
  delete process.env.STDQ_STATIC_DIR;
});

test('v4.1: API jamás publica diseños de borrador mediante PATCH; sólo acción confirmada', async()=>{
  const { TEMPLATE } = await import('./fixtures/bannerTemplate.ts');
  const published={...TEMPLATE,content:{phrase:'TRANSMISIÓN ACTUAL'},visibleInOBS:false};
  const edited={...TEMPLATE,content:{phrase:'BORRADOR PRIVADO'},visibleInOBS:false};
  // Tests can start from an established station snapshot without relying on Electron.
  writeFileSync(join(persistentDir,'station.json'),JSON.stringify({components:{banner:published},draftComponents:{banner:edited}}));
  const rejected=await fetch(base+'/api/station/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({components:{banner:edited}})});
  // Existing station must reject direct design mutations; server process is authoritative.
  assert.equal(rejected.status,409);
  assert.equal(JSON.parse(readFileSync(join(persistentDir,'station.json'),'utf8')).components.banner.content.phrase,'TRANSMISIÓN ACTUAL');
  const withoutConfirm=await fetch(base+'/api/station/publications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publish',id:'banner'})});
  assert.equal(withoutConfirm.status,409);
});

test('V4.2: integración Windows — historial gestionable y estado persistido sin alterar Program',async()=>{
  const {TEMPLATE}=await import('./fixtures/bannerTemplate.ts');
  const station=await (await fetch(base+'/api/station/state')).json();
  const current=(station.state?.components??{}) as any;
  const draft={...TEMPLATE,content:{phrase:'Versión ensayada'},visibleInOBS:false};
  const saveDraft=await fetch(base+'/api/station/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draftComponents:{banner:draft}})});
  assert.equal(saveDraft.status,200);
  const command=(action:unknown)=>fetch(base+'/api/station/publications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});
  const saved=await command({action:'save',id:'banner',label:'Copia de producción'});
  assert.equal(saved.status,200);
  assert.equal((await saved.json()).history.revisions.length,1);
  const renamed=await command({action:'rename',id:'banner',version:1,label:'Apertura final'});
  assert.equal((await renamed.json()).history.revisions[0].label,'Apertura final');
  const restored=await command({action:'restore-draft',id:'banner',version:1});
  assert.equal(restored.status,200);
  const stateAfter=(await (await fetch(base+'/api/station/state')).json()).state;
  assert.equal(stateAfter.draftComponents.banner.content.phrase,'Versión ensayada');
  assert.deepEqual(stateAfter.components??{},current,'restauración nunca cambia el diseño publicado');
  assert.equal(stateAfter.publicationHistory.banner.revisions.length,1);
  const persisted=JSON.parse(readFileSync(join(persistentDir,'station.json'),'utf8'));
  assert.equal(persisted.publicationHistory.banner.revisions[0].label,'Apertura final');
  const published=await command({action:'publish',id:'banner',confirm:'PUBLICAR'});
  assert.equal(published.status,200);
  const afterPublish=JSON.parse(readFileSync(join(persistentDir,'station.json'),'utf8'));
  assert.equal(afterPublish.components.banner.content.phrase,'Versión ensayada');
  assert.equal(afterPublish.publicationHistory.banner.revisions.length,1,'publicar no genera historial');
});

test('native Direct status uses the real supervisor, not a simulated camera flag', async()=>{
  const nativeStatus={state:'running',pid:4321,error:null,camera:0,url:'http://127.0.0.1:3000/?overlay=direct-program'};
  const nativeServer=createServer(createStationHandler(staticDir,()=>nativeStatus));
  await new Promise<void>(resolve=>nativeServer.listen(0,'127.0.0.1',resolve));
  const addr=nativeServer.address();
  const nativeBase=`http://127.0.0.1:${typeof addr==='object'&&addr?addr.port:0}`;
  try {
    const status=await fetch(nativeBase+'/api/direct/status');
    assert.equal(status.status,200);
    assert.deepEqual(await status.json(),nativeStatus);
    const blocked=await fetch(nativeBase+'/api/direct/status',{headers:{Origin:'https://another-site.example'}});
    assert.equal(blocked.status,403);
    const unsupported=await fetch(nativeBase+'/api/direct/status',{method:'POST'});
    assert.equal(unsupported.status,405);
  }finally{
    await new Promise<void>(resolve=>nativeServer.close(()=>resolve()));
  }
});
