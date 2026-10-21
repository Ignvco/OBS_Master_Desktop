import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, listBackups, restoreBackup, inspectRuntime } from '../server/recovery.ts';

const home = await mkdtemp(join(tmpdir(), 'stdq-recovery-'));
await mkdir(join(home, 'media'));
await mkdir(join(home, 'assets'));
await writeFile(join(home, 'station.json'), JSON.stringify({ episode: { title: 'TU TURNO' } }));
await writeFile(join(home, 'library.json'), JSON.stringify({ episodes: ['chapter1'] }));
await writeFile(join(home, 'media', 'intro.mp4'), Buffer.from('intro-video-test'));
await writeFile(join(home, 'assets', 'logo.png'), Buffer.from('logo-test'));
let created: Awaited<ReturnType<typeof createBackup>>;

test('recovery guarda catálogo, estado, logo y multimedia con checksums', async () => {
  created = await createBackup(home);
  assert.equal(created.files.length, 4);
  assert.equal(created.files.find(f=>f.path==='media/intro.mp4')?.sha256.length,64);
  const backups = await listBackups(home);
  assert.equal(backups[0].id, created.id);
});

test('recovery restaura archivos y crea punto de seguridad previo', async () => {
  await writeFile(join(home, 'station.json'), JSON.stringify({ episode: { title: 'CHANGED' } }));
  await writeFile(join(home, 'media', 'intro.mp4'), Buffer.from('damaged-video'));
  const restored = await restoreBackup(home, created.id);
  assert.ok(restored.restored.includes('station.json'));
  assert.ok(restored.safetyBackup);
  assert.match(await readFile(join(home, 'station.json'), 'utf8'), /TU TURNO/);
  assert.equal(await readFile(join(home, 'media', 'intro.mp4'), 'utf8'), 'intro-video-test');
});

test('recovery detecta corrupción de respaldo antes de sobrescribir datos', async () => {
  await writeFile(join(home, 'backups', created.id, 'assets', 'logo.png'), 'tampered');
  await writeFile(join(home, 'station.json'), '{"stable":true}');
  await assert.rejects(restoreBackup(home, created.id), /alterado o incompleto/);
  assert.equal(await readFile(join(home, 'station.json'), 'utf8'), '{"stable":true}');
});

test('recovery no acepta IDs con recorrido de rutas', async () => {
  await assert.rejects(restoreBackup(home, '../secrets'), /Identificador/);
});

test('diagnóstico distingue archivos corruptos de archivos que aún no existen', async () => {
  await writeFile(join(home, 'station.json'), 'not-json');
  const report = await inspectRuntime(home);
  assert.equal(report.checks.find(x=>x.id==='station.json')?.ok, false);
  assert.equal(report.checks.find(x=>x.id==='writable')?.ok,true);
});

test.after(async () => { await rm(home, { recursive:true, force:true }); });

test('v4.1: restaurar no reactiva indicadores AL AIRE provenientes del respaldo',async()=>{
  const isolated=await mkdtemp(join(tmpdir(),'stdq-safe-recovery-'));
  try{
    const station={components:{banner:{visibleInOBS:true,content:{phrase:'PUBLICADA'}}},customComponents:{'gfx-test':{visibleInOBS:true}},draftComponents:{banner:{content:{phrase:'BORRADOR'}}}};
    await writeFile(join(isolated,'station.json'),JSON.stringify(station));
    const copy=await createBackup(isolated);
    await writeFile(join(isolated,'station.json'),JSON.stringify({different:true}));
    await restoreBackup(isolated,copy.id);
    const result=JSON.parse(await readFile(join(isolated,'station.json'),'utf8'));
    assert.equal(result.components.banner.visibleInOBS,false);
    assert.equal(result.customComponents['gfx-test'].visibleInOBS,false);
    assert.equal(result.draftComponents.banner.content.phrase,'BORRADOR');
    assert.equal(result.components.banner.content.phrase,'PUBLICADA');
  }finally{await rm(isolated,{recursive:true,force:true});}
});

test('v4.1: se rechazan manifests con duplicados antes de restaurar',async()=>{
  const isolated=await mkdtemp(join(tmpdir(),'stdq-tampered-manifest-'));
  try{
    await writeFile(join(isolated,'station.json'),JSON.stringify({safe:true}));
    const copy=await createBackup(isolated);
    const filepath=join(isolated,'backups',copy.id,'manifest.json');
    const manifest=JSON.parse(await readFile(filepath,'utf8'));
    manifest.files.push({...manifest.files[0]});
    manifest.totalBytes*=2;
    await writeFile(filepath,JSON.stringify(manifest));
    await assert.rejects(restoreBackup(isolated,copy.id),/manifiesto.*inválido/i);
  }finally{await rm(isolated,{recursive:true,force:true});}
});
