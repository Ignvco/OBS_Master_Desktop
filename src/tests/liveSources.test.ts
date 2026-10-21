import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingLiveSources, listBindableSources } from '../utils/liveSources.ts';

const sources = [
  { id: '1', name: 'EMEET 4K', type: 'dshow_input', enabled: true, locked: false },
  { id: '2', name: 'Mi Banner Personal', type: 'browser_source', enabled: true, locked: false },
  { id: '3', name: 'GFX_CINTA', type: 'browser_source', enabled: false, locked: false },
];
test('panel En Vivo solo vincula fuentes Browser Source', () => {
  assert.deepEqual(listBindableSources(sources).map(source => source.name), ['Mi Banner Personal', 'GFX_CINTA']);
});
test('enlace manual tiene prioridad sobre coincidencia automática, sin permitir aproximaciones', () => {
  assert.deepEqual(matchingLiveSources(sources, { name: 'Banner' }, 'banner', 'Mi Banner Personal').map(x => x.id), ['2']);
  assert.equal(matchingLiveSources(sources, { name: 'Banner' }, 'banner').length, 0);
  assert.deepEqual(matchingLiveSources(sources, { name: 'Cinta' }, 'ticker').map(x => x.id), ['3']);
});

const knownId='gfx-1234567890abcdef12345678';
test('detección por URL descubre un componente propio sin enlace manual',()=>{
  const config={name:'Gráfica libre',instanceId:knownId};
  const discovered=matchingLiveSources([
    {id:'a',name:'Studio Graphic',type:'browser_source',enabled:false,locked:false,browserUrl:`http://127.0.0.1:3000/?overlayId=${knownId}`},
    {id:'b',name:'Camera',type:'dshow_input',enabled:true,locked:false},
    {id:'c',name:'Another Graphic',type:'browser_source',enabled:true,locked:false,browserUrl:'http://127.0.0.1:3000/?overlayId=gfx-aaaaaaaaaaaaaaaaaaaaaaaa'},
  ],config,'editorial');
  assert.deepEqual(discovered.map(x=>x.id),['a']);
});
test('vínculo manual no puede alterar una fuente ajena cuya URL sí fue verificada',()=>{
  const sources=[{id:'1',name:'Nombre equivocado',type:'browser_source',enabled:true,locked:false,browserUrl:'http://127.0.0.1:3000/?overlayId=gfx-ffffffffffffffffffffffff'}];
  assert.equal(matchingLiveSources(sources,{name:'Libre',instanceId:knownId},'editorial','Nombre equivocado').length,0);
  assert.equal(matchingLiveSources([{...sources[0],name:'Cámara',type:'dshow_input'}],{name:'Cámara'},'banner','Cámara').length,0);
});
test('plantilla por URL se reconoce incluso si el operador renombra la fuente',()=>{
  const sources=[{id:'1',name:'Texto bonito',type:'browser_source',enabled:false,locked:false,browserUrl:'http://localhost:3000/?overlay=banner'}];
  assert.equal(matchingLiveSources(sources,{name:'Banner'},'banner').length,1);
  assert.equal(matchingLiveSources(sources,{name:'Ticker'},'ticker').length,0);
});
