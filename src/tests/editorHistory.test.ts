import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHistory,pushHistory,stepHistory,historyFlags} from '../utils/editorHistory.ts';
test('deshacer y rehacer restauran configuraciones sin mutar snapshots',()=>{
  const first={x:10,text:'A'};
  let history=createHistory(first);
  history=pushHistory(history,{x:20,text:'A'},'geometry:x',1000);
  history=pushHistory(history,{x:30,text:'A'},'geometry:x',1150);
  assert.equal(history.snapshots.length,2);
  let step=stepHistory(history,-1);
  assert.deepEqual(step.value,first);
  assert.deepEqual(historyFlags(step.state),{canUndo:false,canRedo:true});
  step=stepHistory(step.state,1);
  assert.deepEqual(step.value,{x:30,text:'A'});
});
test('cambios distintos crean pasos y un nuevo cambio después de deshacer invalida rehacer',()=>{
  let h=createHistory({x:0});
  h=pushHistory(h,{x:12},'drag:one',0);
  h=pushHistory(h,{x:27},'drag:one',35000); // A long drag is still one undo unit.
  assert.equal(h.snapshots.length,2);
  const rewound=stepHistory(h,-1).state;
  const next=pushHistory(rewound,{x:8},'drag:two',36000);
  assert.equal(next.snapshots.length,2);
  assert.equal(stepHistory(next,1).value,null);
});
test('el historial acota uso de memoria',()=>{
  let history=createHistory({x:0});
  for(let i=1;i<80;i++) history=pushHistory(history,{x:i},null,i);
  assert.equal(history.snapshots.length,60);
  assert.equal(history.snapshots[history.index].x,79);
});
