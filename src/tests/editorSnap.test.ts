import assert from 'node:assert/strict';
import {test} from 'node:test';
import {snapRect} from '../utils/editorSnap.ts';
test('el ajuste magnético centra un banner dentro del lienzo 1920x1080',()=>{
  const result=snapRect({x:503,y:310,width:900,height:450},[],{x:0,y:0,width:1920,height:1080},10);
  assert.equal(result.rect.x,510);
  assert.equal(result.rect.y,315);
  assert.ok(result.guides.some(x=>x.axis==='x'&&x.value===960));
});
test('alineación inteligente con el borde de otra capa',()=>{
  const result=snapRect({x:214,y:104,width:100,height:35},[{x:210,y:80,width:200,height:90}],{x:0,y:0,width:1920,height:1080},6);
  assert.equal(result.rect.x,210);
});
test('fuera del umbral no mueve el objeto ni muestra guías',()=>{
  const result=snapRect({x:501,y:401,width:150,height:50},[],{x:0,y:0,width:1920,height:1080},5);
  assert.deepEqual(result.rect,{x:501,y:401,width:150,height:50});
  assert.equal(result.guides.length,0);
});
