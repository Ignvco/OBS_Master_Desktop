import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeByCorner,rotateByPointer} from '../utils/transformHandles.ts';
const box={x:100,y:200,width:400,height:200};
test('las cuatro esquinas conservan el borde opuesto',()=>{
  assert.deepEqual(resizeByCorner(box,50,40,'se'),{x:100,y:200,width:450,height:240});
  assert.deepEqual(resizeByCorner(box,50,40,'nw'),{x:150,y:240,width:350,height:160});
  assert.deepEqual(resizeByCorner(box,50,40,'sw'),{x:150,y:200,width:350,height:240});
  assert.deepEqual(resizeByCorner(box,50,40,'ne'),{x:100,y:240,width:450,height:160});
});
test('el tamaño mínimo limita movimientos extremos',()=>{
  assert.deepEqual(resizeByCorner(box,999,999,'nw'),{x:484,y:384,width:16,height:16});
  assert.equal(box.x,100);
});
test('la rotación admite precisión y ajuste en pasos de quince grados',()=>{
  assert.equal(rotateByPointer(0,20,42,false),22);
  assert.equal(rotateByPointer(0,20,42,true),15);
  assert.equal(rotateByPointer(350,0,100,false),360);
});
