import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TEMPLATE } from './fixtures/bannerTemplate.ts';

// Import the bridge under a temporary working dir so tests do not touch user data.
const previousCwd = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'stdq-state-test-'));
process.chdir(temp);
const { stationBridge } = await import('../server/stationBridge.ts');
process.chdir(previousCwd);

const plugin = stationBridge();
let handler: (req: any, res: any, next: () => void) => void = () => {};
(plugin.configureServer as Function)({ middlewares: { use(fn: typeof handler) { handler = fn; } } });
const server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

test('el servidor local empieza sin estado y persiste un snapshot', async () => {
  const first = await (await fetch(`${base}/api/station/state`)).json();
  assert.equal(first.state, null);
  const patch = { countdown: { isRunning: true, remainingSeconds: 80, durationSeconds: 120 } };
  const response = await fetch(`${base}/api/station/state`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  assert.equal(response.status, 200);
  const final = await (await fetch(`${base}/api/station/state`)).json();
  assert.equal(final.state.countdown.remainingSeconds, 80);
  assert.equal(existsSync(join(temp, '.stdq-runtime', 'station.json')), true);
});

test('rechaza modificaciones de sitios externos y campos no permitidos', async () => {
  const foreign = await fetch(`${base}/api/station/state`, { method: 'PATCH', headers: { Origin: 'https://sitio-ajeno.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ countdown: { isRunning: false, remainingSeconds: 0 } }) });
  assert.equal(foreign.status, 403);
  const other = await fetch(`${base}/api/station/state`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ obsPassword: 'no-debe-guardarse' }) });
  assert.equal(other.status, 400);
});

test.after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  rmSync(temp, { recursive: true, force: true });
});

test('upload de logo accesible desde otra sesión de navegador (OBS)', async () => {
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRgAAAABJRU5ErkJggg==', 'base64');
  const response = await fetch(`${base}/api/station/assets/logo`, { method: 'POST', headers: {'Content-Type':'image/png'}, body:tinyPng });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.url, /^\/api\/station\/assets\/[a-f0-9-]+\.png$/);
  const image = await fetch(base + body.url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),tinyPng);
  const rejected = await fetch(`${base}/api/station/assets/logo`, { method:'POST', headers: {'Content-Type':'image/png'}, body:Buffer.from('javascript') });
  assert.equal(rejected.status, 422);
});

test('Biblioteca: guardar capítulo, editar, cargar y eliminar del catálogo persistido', async () => {
  const start = await (await fetch(`${base}/api/station/library`)).json();
  assert.equal(start.library.episodes.length, 0);
  const episode = {
    id:'ep-test', number:9, season:1, title:'Edición especial', subtitle:'Prueba',
    date:'2026-10-19', description:'', hosts:[], tags:[], phrases:[], questions:[],
    scriptures:[], quotes:[], tickerNews:[], rundown:[],
  };
  const post = (body:unknown) => fetch(`${base}/api/station/library`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const created = await post({action:'episode.save', episode});
  assert.equal(created.status,200);
  assert.equal((await created.json()).library.episodes[0].title,'Edición especial');
  const modified = await post({action:'episode.save',episode:{...episode,title:'Edición mejorada'}});
  assert.equal((await modified.json()).library.episodes.length,1);
  assert.equal(existsSync(join(temp,'.stdq-runtime','library.json')),true);
  const invalid = await post({action:'episode.save',episode:{id:'hacked',title:'Incomplete'}});
  assert.equal(invalid.status,400);
  const removed = await post({action:'episode.delete',id:'ep-test'});
  assert.equal((await removed.json()).library.episodes.length,0);
});

test('Biblioteca: upload validado, Range video/imagen, origen y eliminación de medios', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRgAAAABJRU5ErkJggg==', 'base64');
  const denied = await fetch(`${base}/api/station/media`, {method:'POST',headers:{Origin:'https://externo.example','Content-Type':'image/png'},body:png});
  assert.equal(denied.status,403);
  const uploaded = await fetch(`${base}/api/station/media`, {method:'POST',headers:{'Content-Type':'image/png','X-File-Name':'logotipo.png'},body:png});
  assert.equal(uploaded.status,201);
  const data = await uploaded.json();
  assert.equal(data.asset.name,'logotipo.png');
  assert.match(data.asset.url, /^\/api\/station\/media\/[0-9a-f-]{36}\.png$/);
  const full = await fetch(base+data.asset.url);
  assert.equal(full.status,200);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()),png);
  const part = await fetch(base+data.asset.url,{headers:{Range:'bytes=0-7'}});
  assert.equal(part.status,206);
  assert.equal((await part.arrayBuffer()).byteLength,8);
  const wrong = await fetch(`${base}/api/station/media`,{method:'POST',headers:{'Content-Type':'image/png'},body:Buffer.from('<svg>script</svg>')});
  assert.equal(wrong.status,422);
  const status = await (await fetch(`${base}/api/station/library`)).json();
  assert.equal(status.library.assets.find((a:any)=>a.id===data.asset.id).isMissing,false);
  const deleted = await fetch(`${base}/api/station/media-delete`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.asset.id})});
  assert.equal(deleted.status,200);
  assert.equal((await fetch(base+data.asset.url)).status,404);
});

test('Biblioteca: las preferencias se guardan y las solicitudes externas se rechazan', async () => {
  const options = { startTab:'assets', assetView:'list', confirmDeletion:true, backupBeforeSwitch:false };
  const blocked = await fetch(`${base}/api/station/library`, {
    method:'POST', headers:{'Origin':'https://external.example','Content-Type':'application/json'},
    body:JSON.stringify({action:'settings.save',settings:options})
  });
  assert.equal(blocked.status,403);
  const saved = await fetch(`${base}/api/station/library`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'settings.save',settings:options}),
  });
  assert.equal(saved.status,200);
  const read = await (await fetch(`${base}/api/station/library`)).json();
  assert.equal(read.library.settings.startTab,'assets');
  assert.equal(read.library.settings.backupBeforeSwitch,false);
});

test('registro independiente: guardar borradores, publicar, recuperar y rechazar ID corrupto', async () => {
  const {createCustomGraphic}=await import('../utils/componentRegistry.ts');
  const a=createCustomGraphic(TEMPLATE,'Banner 1');
  const b=createCustomGraphic(TEMPLATE,'Banner 2');
  const registry={[a.instanceId!]:a,[b.instanceId!]:b};
  const post=(data:unknown)=>fetch(`${base}/api/station/state`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const command=(action:unknown)=>fetch(`${base}/api/station/publications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});
  assert.equal((await post({draftCustomComponents:registry})).status,200);
  let state=(await (await fetch(`${base}/api/station/state`)).json()).state;
  assert.equal(state.customComponents,undefined,'el borrador no debe aparecer en las fuentes OBS');
  assert.equal(Object.keys(state.draftCustomComponents).length,2);
  assert.equal((await post({customComponents:registry})).status,409,'nadie debe publicar por PATCH');
  assert.equal((await command({action:'publish',id:a.instanceId})).status,409,'requiere confirmación explícita');
  const published=await command({action:'publish',id:a.instanceId,confirm:'PUBLICAR'});
  assert.equal(published.status,200);
  assert.equal((await published.json()).history,null);
  state=(await (await fetch(`${base}/api/station/state`)).json()).state;
  assert.equal(Object.keys(state.customComponents).length,1);
  assert.equal(state.customComponents[a.instanceId!].name,'Banner 1');
  assert.equal((await post({draftCustomComponents:{fake:{...a,instanceId:'fake',id:'fake'}}})).status,400);
  assert.equal((await command({action:'restore-draft',id:a.instanceId,version:42})).status,409);
  assert.equal((await command({action:'save',id:a.instanceId,label:'Primer diseño'})).status,200);
  assert.equal((await command({action:'publish',id:a.instanceId,confirm:'PUBLICAR'})).status,200);
  let history=(await (await fetch(`${base}/api/station/publications`)).json()).history;
  assert.equal(history[a.instanceId!].revisions.length,1,'publicar no añade versiones');
  assert.equal((await command({action:'rename',id:a.instanceId,version:1,label:'Música'})).status,200);
  assert.equal((await command({action:'pin',id:a.instanceId,version:1})).status,200);
  assert.equal((await command({action:'remove',id:a.instanceId,version:1,confirm:'ELIMINAR'})).status,409);
  assert.equal((await command({action:'restore-draft',id:a.instanceId,version:1})).status,200);
  history=(await (await fetch(`${base}/api/station/publications`)).json()).history;
  assert.equal(history[a.instanceId!].revisions.length,1,'restauración al borrador no añade versiones');
  assert.equal((await command({action:'pin',id:a.instanceId,version:1})).status,200);
  assert.equal((await command({action:'remove',id:a.instanceId,version:1,confirm:'ELIMINAR'})).status,200);
  const after=(await (await fetch(`${base}/api/station/publications`)).json()).history;
  assert.equal(after[a.instanceId!].revisions.length,0);

});
