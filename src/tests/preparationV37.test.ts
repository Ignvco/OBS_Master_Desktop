import test from 'node:test';
import assert from 'node:assert/strict';
import type { EpisodeData, RundownBlock } from '../types/index.ts';
import {
  getStartTime, isTime, markBlockStatus, missingGraphics,
  moveBlock, retimeRundown, updateRundown, validateRundown
} from '../utils/preparation.ts';
import { makeEpisode } from '../utils/libraryCatalog.ts';

function block(id:string, duration=60, scene='CAM_1'):RundownBlock {
  return {id,order:0,timePlanned:'00:00:00',title:id,presenter:'Conductor',durationSeconds:duration,obsSceneTarget:scene,graphicComponents:[],notes:'',status:'pending'};
}
function episode(blocks:RundownBlock[]):EpisodeData {
  return {id:'ep-test',number:1,season:1,title:'Prueba',subtitle:'',date:'',description:'',hosts:[],tags:[],phrases:[],questions:[],scriptures:[],quotes:[],tickerNews:[],rundown:blocks};
}

test('time validator rejects invalid hour or minute',()=>{
  assert.equal(isTime('21:30'),true);
  assert.equal(isTime('21:30:15'),true);
  assert.equal(isTime('25:10'),false);
  assert.equal(isTime('21:73'),false);
  assert.equal(isTime('fake'),false);
});
test('rundown retimes consecutive blocks and stable order',()=>{
  const next=retimeRundown([block('intro',90),block('saludo',120),block('cierre',30)],'21:00');
  assert.deepEqual(next.map(x=>x.timePlanned),['21:00:00','21:01:30','21:03:30']);
  assert.deepEqual(next.map(x=>x.order),[1,2,3]);
});
test('reorder keeps block identities and recalculates timing',()=>{
  const prev=[block('a',60),block('b',120),block('c',30)];
  const result=retimeRundown(moveBlock(prev,'b',-1),'21:00');
  assert.deepEqual(result.map(b=>b.id),['b','a','c']);
  assert.deepEqual(result.map(b=>b.timePlanned),['21:00:00','21:02:00','21:03:00']);
});
test('midnight wrap remains 24h formatted',()=>{
  const next=retimeRundown([block('a',120),block('b',60)],'23:59');
  assert.deepEqual(next.map(b=>b.timePlanned),['23:59:00','00:01:00']);
});
test('planning uses legacy start time if new prep field missing',()=>{
  const e=episode([{...block('a'),timePlanned:'20:13:00'}]);
  assert.equal(getStartTime(e),'20:13');
  assert.equal(updateRundown(e,e.rundown,'21:00').preparation?.startTime,'21:00');
});
test('invalid scenes detected only when connected',()=>{
  const blocks=[block('a',120,'CAM_BAD')];
  assert.equal(validateRundown(blocks,['CAM_1'],false).length,0);
  assert.match(validateRundown(blocks,['CAM_1'],true)[0],/no existe/);
});
test('duration, title and scene are validated',()=>{
  const broken={...block(''),durationSeconds:-10,obsSceneTarget:''};
  assert.equal(validateRundown([broken],[],true).length,3);
});
test('single active block marked on air; others completed',()=>{
  const prev=[{...block('a'),status:'on-air' as const},block('b')];
  const next=markBlockStatus(prev,'b','on-air');
  assert.equal(next[0].status,'completed');
  assert.equal(next[1].status,'on-air');
});
test('graphic plans detect configured missing types',()=>{
  const blocks=[{...block('a'),graphicComponents:['banner','quote','banner'] as RundownBlock['graphicComponents']}];
  assert.deepEqual(missingGraphics(blocks,{banner:{}}),['quote']);
});
test('new episode clears manual preflight checks without mutating original',()=>{
  const base={...episode([block('a')]),preparation:{startTime:'21:00',manualChecks:{macAudio:true,streamyard:true}}};
  const next=makeEpisode(base,2,'Episodio nuevo',false);
  assert.deepEqual(next.preparation?.manualChecks,{});
  assert.equal(base.preparation.manualChecks.macAudio,true);
});
