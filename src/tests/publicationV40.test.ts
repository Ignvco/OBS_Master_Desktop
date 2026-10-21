import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE } from './fixtures/bannerTemplate.ts';
import { createCustomGraphic } from '../utils/componentRegistry.ts';
import {applyPublication,saveRevision,restoreRevisionToDraft,manageRevision,operationalOnlyPatch,PUBLICATION_HISTORY_LIMIT} from '../utils/publicationEngine.ts';

test('publicar actualiza solo publicado y NO genera revisiones',()=>{
  const live={...TEMPLATE,content:{phrase:'EN VIVO'}};
  const draft={...TEMPLATE,content:{phrase:'BORRADOR'}};
  const state:any={components:{banner:live},draftComponents:{banner:draft}};
  const after=applyPublication(state,'banner');
  assert.equal(after.components?.banner.content.phrase,'BORRADOR');
  assert.equal(after.publicationHistory,undefined);
  assert.equal(state.components.banner.content.phrase,'EN VIVO');
  const again=applyPublication(after,'banner');
  assert.equal(again.publicationHistory,undefined);
});
test('bloquea publicación con gráfica marcada al aire',()=>{
  assert.throws(()=>applyPublication({components:{banner:{...TEMPLATE,visibleInOBS:true}} as any,draftComponents:{banner:TEMPLATE} as any},'banner'),/Retira/);
});
test('guardar versión es explícito; restaurar solo recupera borrador sin afectar la emisión',()=>{
  const initial:any={components:{banner:{...TEMPLATE,content:{phrase:'LIVE'}}},draftComponents:{banner:{...TEMPLATE,content:{phrase:'V1'}}}};
  const a=saveRevision(initial,'banner','Primera');
  const b=saveRevision({...a,draftComponents:{banner:{...TEMPLATE,content:{phrase:'V2'}}} as any},'banner','Segunda');
  const restored=restoreRevisionToDraft(b,'banner',1);
  assert.equal(restored.draftComponents?.banner.content.phrase,'V1');
  assert.equal(restored.components?.banner.content.phrase,'LIVE');
  assert.equal(restored.publicationHistory?.banner.revisions.length,2);
  assert.equal(applyPublication(restored,'banner').publicationHistory?.banner.revisions.length,2);
});
test('gráficas independientes se publican sin alterar otros documentos',()=>{
  const custom=createCustomGraphic(TEMPLATE,'Invitado');
  const result=applyPublication({draftCustomComponents:{[custom.instanceId!]:custom}},custom.instanceId!);
  assert.equal(result.customComponents?.[custom.instanceId!].instanceId,custom.instanceId);
  assert.equal(result.publicationHistory,undefined);
});
test('PATCH de publicados solo permite cambios operacionales',()=>{
  const state={banner:TEMPLATE};
  assert.equal(operationalOnlyPatch(state,{banner:{...TEMPLATE,visibleInOBS:true}}),true);
  assert.equal(operationalOnlyPatch(state,{banner:{...TEMPLATE,animationReplay:3}}),true);
  assert.equal(operationalOnlyPatch(state,{banner:{...TEMPLATE,content:{phrase:'X'}}}),false);
  assert.equal(operationalOnlyPatch(state,{banner:{...TEMPLATE},other:TEMPLATE}),false);
});
test('historial limitado a 20, números monótonos y protección respetada',()=>{
  let state:any={draftComponents:{banner:TEMPLATE}};
  for(let n=1;n<=PUBLICATION_HISTORY_LIMIT+3;n++) state=saveRevision(state,'banner',`Checkpoint ${n}`);
  assert.equal(state.publicationHistory.banner.currentVersion,23);
  assert.equal(state.publicationHistory.banner.revisions.length,PUBLICATION_HISTORY_LIMIT);
  assert.equal(state.publicationHistory.banner.revisions[0].version,4);
  state=manageRevision(state,'banner',4,'pin');
  state=saveRevision(state,'banner','Último');
  assert.ok(state.publicationHistory.banner.revisions.some((r:any)=>r.version===4 && r.pinned));
  assert.throws(()=>manageRevision(state,'banner',4,'remove'),/desprotege/);
});
test('gestionar renombrado, protección y borrado conserva el contador sin falsos eventos',()=>{
  let state:any=saveRevision({draftComponents:{banner:TEMPLATE} as any},'banner','Primera');
  state=manageRevision(state,'banner',1,'rename','Apertura');
  assert.equal(state.publicationHistory.banner.revisions[0].label,'Apertura');
  state=manageRevision(state,'banner',1,'pin');
  assert.equal(state.publicationHistory.banner.revisions[0].pinned,true);
  state=manageRevision(state,'banner',1,'pin');
  state=manageRevision(state,'banner',1,'remove');
  assert.equal(state.publicationHistory.banner.revisions.length,0);
  assert.equal(saveRevision(state,'banner','Nuevo').publicationHistory?.banner.currentVersion,2);
});
test('historial antiguo se preserva y se puede restaurar al borrador',()=>{
  const original={...TEMPLATE,content:{phrase:'LEGACY'}};
  const state:any={components:{banner:original},draftComponents:{banner:TEMPLATE},publicationHistory:{banner:{currentVersion:5,revisions:[{version:5,action:'publish',publishedAt:'2026-10-19',config:original}]}}};
  const restored=restoreRevisionToDraft(state,'banner',5);
  assert.equal(restored.draftComponents?.banner.content.phrase,'LEGACY');
  assert.equal(restored.publicationHistory?.banner.currentVersion,5);
  assert.equal(restored.components?.banner.content.phrase,'LEGACY');
});
