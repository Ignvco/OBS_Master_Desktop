import assert from 'node:assert/strict';
import test from 'node:test';
import {selectLayer,assignGroup,membersOfGroup,moveSelection,alignSelection,distributeSelection,duplicateCustomSelection} from '../utils/workspaceEditing.ts';
import type {EditorialComponentConfig} from '../types/index.ts';

function fixture(): EditorialComponentConfig {
  return {
    id:'lower-third',type:'lower-third',name:'Banda',visibleInOBS:false,content:{},
    font:{family:'Plus Jakarta Sans',size:20,weight:600,lineHeight:1,letterSpacing:0,color:'#fff',textTransform:'none',align:'left'},
    geometry:{x:0,y:0,width:1920,height:1080,scale:1,rotation:0,opacity:1,borderRadius:0,borderWidth:0,borderColor:'#fff',backgroundColor:'transparent',boxShadow:'none',padding:0},
    animation:{preset:'apple-spring',entryDurationMs:400,exitDurationMs:250,delayMs:0,easing:'linear',staggerWords:false,direction:'up',loopPulse:false},
    layers:[
      {id:'a',kind:'text',name:'A',x:10,y:20,width:100,height:40,rotation:0,opacity:1,zIndex:10,hidden:false,locked:false},
      {id:'b',kind:'shape',name:'B',x:240,y:80,width:80,height:40,rotation:0,opacity:1,zIndex:11,hidden:false,locked:false},
      {id:'c',kind:'text',name:'C',x:420,y:100,width:100,height:40,rotation:0,opacity:1,zIndex:12,hidden:false,locked:false}
    ], updatedAt:'2026-01-01'
  };
}
test('Ctrl/Shift selection works and ignores invalid IDs',()=>{
  const config=fixture();
  assert.deepEqual(selectLayer(config,[],'a','replace'),['a']);
  assert.deepEqual(selectLayer(config,['a'],'b','toggle'),['a','b']);
  assert.deepEqual(selectLayer(config,['a','b'],'a','toggle'),['b']);
  assert.deepEqual(selectLayer(config,['a'],'nonexistent','toggle'),['a']);
});
test('logical groups survive persistence and select all members',()=>{
  const config={...fixture(),...assignGroup(fixture(),['a','b'],'group-1')};
  assert.deepEqual(membersOfGroup(config,'a'),['a','b']);
  assert.deepEqual(selectLayer(config,[],'b','replace'),['a','b']);
  const undone={...config,...assignGroup(config,['a','b'],undefined)};
  assert.deepEqual(membersOfGroup(undone,'b'),['b']);
});
test('multi-move updates originals and custom layers without changing unrelated geometry',()=>{
  const start=fixture();
  const next={...start,...moveSelection(start,['headline','a','b'],12,-7)};
  assert.equal(next.layers?.[0].x,22);
  assert.equal(next.layers?.[1].y,73);
  assert.equal(next.layers?.[2].x,420);
  assert.equal(next.layerOverrides?.headline.x,12);
  assert.equal(next.geometry.x,start.geometry.x);
  assert.equal(start.layers?.[0].x,10);
});
test('locked layers stay in place for a batch move',()=>{
  const config=fixture();config.layers![1].locked=true;
  const next=moveSelection(config,['a','b'],50,20);
  assert.equal(next.layers?.[0].x,60);
  assert.equal(next.layers?.[1].x,240);
});
test('align shapes by measured bounds instead of guessed template positions',()=>{
  const config=fixture();
  const rects={a:{x:10,y:20,width:100,height:40},b:{x:240,y:80,width:80,height:40}};
  const next=alignSelection(config,['a','b'],rects,'left');
  assert.equal(next.layers?.[0].x,10);
  assert.equal(next.layers?.[1].x,10);
  const centered=alignSelection(config,['a','b'],rects,'center-y');
  assert.equal(centered.layers?.[0].y,50);
  assert.equal(centered.layers?.[1].y,50);
});
test('distribute three elements evenly between outer bounding edges',()=>{
  const config=fixture();
  const rects={a:{x:10,y:20,width:100,height:40},b:{x:240,y:80,width:80,height:40},c:{x:420,y:100,width:100,height:40}};
  const next=distributeSelection(config,['a','b','c'],rects,'x');
  // Outer span=510, occupied=280, two equal gaps of 115.
  assert.equal(next.layers?.[0].x,10);
  assert.equal(next.layers?.[1].x,225);
  assert.equal(next.layers?.[2].x,420);
});
test('duplicates only editable custom layers and assigns new IDs/group IDs',()=>{
  const config={...fixture(),...assignGroup(fixture(),['a','b'],'group-1')};
  let idx=0;
  const result=duplicateCustomSelection(config,['headline','a','b'],()=>`new-${++idx}`);
  assert.equal(result.ids.length,2);
  const clones=result.patch.layers!.slice(-2);
  assert.deepEqual(clones.map(x=>x.id),result.ids);
  assert.equal(clones[0].groupId,clones[1].groupId);
  assert.notEqual(clones[0].groupId,'group-1');
  assert.equal(clones[0].x,30);
  assert.equal(config.layers?.length,3);
});
