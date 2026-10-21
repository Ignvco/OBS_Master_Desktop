import test from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATE} from './fixtures/bannerTemplate.ts';
import {selectDirectProgramGraphics} from '../utils/directComposition.ts';

test('Direct Program selects visible published graphics in stable paint order',()=>{
  const banner={...TEMPLATE,visibleInOBS:true,animationReplay:2};
  const question={...TEMPLATE,id:'question',type:'question' as const,name:'Pregunta',visibleInOBS:true};
  const hidden={...TEMPLATE,id:'ticker',type:'ticker' as const,name:'Ticker',visibleInOBS:false};
  const custom={...TEMPLATE,id:'gfx-a',instanceId:'gfx-aaaaaaaaaaaaaaaaaaaaaaaa',visibleInOBS:true};
  const published:any={banner,question,ticker:hidden};
  const result=selectDirectProgramGraphics(published,{[custom.instanceId]:custom});
  assert.deepEqual(result.map(x=>x.type),['banner','question','banner']);
  assert.equal(result[0].animationReplay,2,'Motion counter must reach program');
  assert.equal(result[2].instanceId,custom.instanceId);
});

test('Direct Program does not receive a draft, and hidden graphics never render',()=>{
  const published:any={banner:{...TEMPLATE,content:{phrase:'ON AIR'},visibleInOBS:true}};
  const draft:any={banner:{...TEMPLATE,content:{phrase:'PRIVATE DRAFT'},visibleInOBS:true}};
  const result=selectDirectProgramGraphics(published,{});
  assert.equal(result.length,1);
  assert.equal(result[0].content.phrase,'ON AIR');
  assert.notEqual(result[0].content.phrase,draft.banner.content.phrase);
  const hidden=selectDirectProgramGraphics({banner:{...published.banner,visibleInOBS:false}} as any,{});
  assert.equal(hidden.length,0);
});
