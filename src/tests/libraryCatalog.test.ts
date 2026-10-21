import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, isLibrary, isMediaAsset, makeEpisode, nextEpisodeNumber, upsertAsset, upsertEpisode } from '../utils/libraryCatalog.ts';
import { sniffMedia, MAX_MEDIA_BYTES } from '../server/mediaStore.ts';

const sampleEpisode = () => ({
  id: 'ep-10', number: 10, season: 1, title: 'Tu Turno', subtitle: 'Llamado y oportunidad',
  date: '2026-10-19', description: '', hosts: [], tags: [], phrases: ['Tu turno'], questions: [],
  scriptures: [], quotes: [], tickerNews: [], rundown: [{ id:'b1', order:0, timePlanned:'00:00', title:'Intro', presenter:'', durationSeconds:60, obsSceneTarget:'INTRO', graphicComponents:[], notes:'', status:'completed' as const }],
});

test('Biblioteca valida el catálogo y rechaza rutas inyectadas', () => {
  const library = emptyLibrary();
  library.episodes = upsertEpisode(library.episodes, sampleEpisode());
  assert.equal(isLibrary(library), true);
  assert.equal(isMediaAsset({ id:'s', name:'Hack', type:'image', url:'/../../etc/passwd', uploadedAt: new Date().toISOString() }),false);
  assert.equal(isLibrary({ ...library, episodes: [library.episodes[0],library.episodes[0]] }), false);
});

test('Editar episodio reemplaza registro y conserva demás entradas', () => {
  const first = sampleEpisode();
  const next = makeEpisode(first, nextEpisodeNumber([first]), 'Segundo', true);
  assert.equal(next.number, 11);
  assert.notEqual(next.id,first.id);
  assert.notEqual(next.rundown[0].id,first.rundown[0].id);
  assert.equal(next.rundown[0].status,'pending');
  let episodes = upsertEpisode([first], next);
  episodes = upsertEpisode(episodes, {...first, title:'Revisado'});
  assert.equal(episodes.length,2);
  assert.equal(episodes.find(e=>e.id===first.id)?.title,'Revisado');
});

test('Catálogo de medios rechaza URLs externas y acepta recursos locales', () => {
  const asset = { id:'a', name:'Logo', type:'image' as const, url:'/assets/stdq-logo-oficial.png', uploadedAt:'2026-10-19' };
  assert.equal(isMediaAsset(asset),true);
  assert.equal(isMediaAsset({...asset,url:'https://evil.example/logo.png'}),false);
  assert.equal(upsertAsset([asset], {...asset,name:'Logo nuevo'})[0].name,'Logo nuevo');
});

test('Sniffing de formatos multimedia no confía en extensión o Content-Type', () => {
  assert.equal(sniffMedia(Buffer.from([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(sniffMedia(Buffer.from('0000ftypisom')),'video/mp4');
  assert.equal(sniffMedia(Buffer.from([0x1a,0x45,0xdf,0xa3])),'video/webm');
  assert.equal(sniffMedia(Buffer.from('<svg onload="alert(1)"></svg>')),null);
  assert.equal(MAX_MEDIA_BYTES,150*1024*1024);
});
