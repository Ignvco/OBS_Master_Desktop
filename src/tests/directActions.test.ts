import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE } from './fixtures/bannerTemplate.ts';
import { directVisibilityPatch, directReplayPatch, directHideAllPatch, parseOutputMode } from '../utils/directActions.ts';

const state:any = {
  components: {banner:{...TEMPLATE,visibleInOBS:false,animationReplay:0}},
  customComponents: {},
};
test('output mode accepts only explicit direct',()=>{
  assert.equal(parseOutputMode('direct'),'direct');
  assert.equal(parseOutputMode('obs'),'obs');
  assert.equal(parseOutputMode('other'),'obs');
  assert.equal(parseOutputMode(null),'obs');
});
test('Direct visibility updates published operational state without changing draft/history',()=>{
  const updated = directVisibilityPatch(state,'banner',true) as any;
  assert.equal(updated.components.banner.visibleInOBS,true);
  assert.equal(state.components.banner.visibleInOBS,false);
  assert.equal(updated.components.banner.content,state.components.banner.content);
  assert.equal(updated.publicationHistory,undefined);
});
test('Direct cannot replay a hidden graphic',()=>{
  assert.throws(()=>directReplayPatch(state,'banner'),/Primero muestra/);
});
test('Direct replay increments the existing replay counter',()=>{
  const active = {...state,components:{banner:{...state.components.banner,visibleInOBS:true}}};
  const updated=directReplayPatch(active,'banner') as any;
  assert.equal(updated.components.banner.animationReplay,1);
  assert.equal(active.components.banner.animationReplay,0);
});
test('Direct panic hides published graphics without modifying history',()=>{
  const active={...state,components:{banner:{...state.components.banner,visibleInOBS:true}}};
  const updated=directHideAllPatch(active as any);
  assert.equal(updated.components.banner.visibleInOBS,false);
  assert.equal(active.components.banner.visibleInOBS,true);
  assert.equal((updated as any).publicationHistory,undefined);
});
