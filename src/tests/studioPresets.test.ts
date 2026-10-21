import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {EditorialComponentConfig} from '../types/index.ts';
import {
  cleanLayerStyle,captureLayerStyle,applyStyleToSelection,updateSelectionProperty,
  compositionSnapshot,applyCompositionPreset,validStudioPreset
} from '../utils/studioPresets.ts';
import {mutateStudioPresets,readStudioPresets} from '../server/studioPresetsStore.ts';
import {createBackup,restoreBackup} from '../server/recovery.ts';
const make=():EditorialComponentConfig=>({
  id:'banner',type:'banner',name:'Banner',visibleInOBS:true,
  content:{category:'HOY',phrase:'TU TURNO'},
  font:{family:'Plus Jakarta Sans',size:36,weight:700,lineHeight:1.1,letterSpacing:0,color:'#FFFFFF',textTransform:'none',align:'left'},
  geometry:{x:0,y:0,width:900,height:120,scale:1,rotation:0,opacity:1,borderRadius:0,borderWidth:0,borderColor:'#FFFFFF',backgroundColor:'#000000',boxShadow:'none',padding:10},
  animation:{preset:'apple-spring',entryDurationMs:300,exitDurationMs:200,delayMs:0,easing:'linear',staggerWords:false,direction:'none',loopPulse:false},
  layers:[
    {id:'custom',kind:'text',name:'Texto',x:40,y:15,width:200,height:80,rotation:0,opacity:1,zIndex:12,hidden:false,locked:false,text:'¡HOLA!',fontSize:55,fontWeight:800,color:'#FFFFFF',backgroundColor:'transparent',shadowPreset:'glow'},
    {id:'locked',kind:'shape',name:'Bloqueado',x:80,y:25,width:100,height:80,rotation:0,opacity:1,zIndex:11,hidden:false,locked:true,color:'#FF6B00'}
  ],layerOverrides:{headline:{x:27,color:'#FF6B00'},kicker:{locked:true,color:'#FFFFFF'}},updatedAt:new Date().toISOString()
});
const presetId='preset-test1234';
const date='2026-10-20T12:00:00.000Z';
test('captura estilo sin posición, texto, recurso, bloqueo o identidad',()=>{
  const style=captureLayerStyle(make(),'custom');
  assert.equal(style.color,'#FFFFFF');assert.equal(style.fontSize,55);assert.equal(style.shadowPreset,'glow');
  assert.equal('x' in style,false);assert.equal('text' in style,false);assert.equal('locked' in style,false);
});
test('el limpiador rechaza CSS arbitrario, URLs, números fuera de rango y llaves peligrosas',()=>{
  const style=cleanLayerStyle(JSON.parse('{"__proto__":{"isAdmin":true},"backgroundColor":"url(https://bad)","color":"#FFFFFF","fontSize":9999,"shapePreset":"blob","gradientMode":"linear"}'));
  assert.deepEqual(style,{color:'#FFFFFF',shapePreset:'blob',gradientMode:'linear'});
  assert.equal(({} as any).isAdmin,undefined);
});
test('aplica estilos visuales pero no mueve capas ni altera texto o señal En Vivo',()=>{
  const initial=make();const patch=applyStyleToSelection(initial,['custom','headline','locked','kicker'],{color:'#123456',fontSize:80,opacity:.5});
  assert.equal(patch.layers?.[0].x,40);assert.equal(patch.layers?.[0].text,'¡HOLA!');
  assert.equal(patch.layers?.[0].fontSize,80);assert.equal(patch.layers?.[1].color,'#FF6B00');
  assert.equal(patch.layerOverrides?.headline?.color,'#123456');assert.equal(patch.layerOverrides?.kicker?.color,'#FFFFFF');
  assert.equal(initial.visibleInOBS,true);assert.equal(initial.layerOverrides?.headline?.color,'#FF6B00');
});
test('edición múltiple preserva las capas bloqueadas y las demás propiedades',()=>{
  const x=make();const patch=updateSelectionProperty(x,['custom','locked','headline','kicker'],'opacity',.6);
  assert.equal(patch.layers?.[0].opacity,.6);assert.equal(patch.layers?.[1].opacity,1);
  assert.equal(patch.layerOverrides?.headline?.opacity,.6);assert.equal(patch.layerOverrides?.kicker?.opacity,undefined);
});
test('composición reversible no reemplaza visibilidad, identidad ni contenido de otro tipo',()=>{
  const base=make();const preset={id:presetId,name:'Mi banner',kind:'composition' as const,createdAt:date,sourceType:'banner' as const,composition:compositionSnapshot(base)};
  assert.ok(validStudioPreset(preset));
  const target={...base,visibleInOBS:false,id:'banner-en-mesa',content:{phrase:'OTRA FRASE'}};
  const patch=applyCompositionPreset(target,preset);
  assert.equal(patch.content?.phrase,'TU TURNO');assert.equal(target.visibleInOBS,false);assert.equal(target.id,'banner-en-mesa');
  assert.throws(()=>applyCompositionPreset({...target,type:'waiting'},preset),/incompatible/);
});
test('Biblioteca de estilos persiste en archivo AppData, edita y elimina sin tocar escenas',()=>{
  const dir=mkdtempSync(join(tmpdir(),'stdq-styles-'));
  try{
    const preset={id:presetId,name:'Editorial suave',kind:'style' as const,createdAt:date,style:{color:'#FFFFFF',fontSize:44}};
    assert.deepEqual(readStudioPresets(dir),[]);
    assert.equal(mutateStudioPresets({action:'save',preset},dir).length,1);
    assert.equal(readStudioPresets(dir)[0].style?.fontSize,44);
    assert.deepEqual(mutateStudioPresets({action:'delete',id:presetId},dir),[]);
    assert.deepEqual(JSON.parse(readFileSync(join(dir,'studio-presets.json'),'utf8')),[]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Recovery Center respalda y restaura los estilos propios',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'stdq-styles-backup-'));
  try{
    const a={id:presetId,name:'Guardado',kind:'style' as const,createdAt:date,style:{color:'#FF6B00'}};
    mutateStudioPresets({action:'save',preset:a},dir);
    const backup=await createBackup(dir);
    const b={...a,id:'preset-test5678',name:'Nuevo'};
    mutateStudioPresets({action:'save',preset:b},dir);
    assert.equal(readStudioPresets(dir).length,2);
    const result=await restoreBackup(dir,backup.id);
    assert.ok(result.restored.includes('studio-presets.json'));
    assert.deepEqual(readStudioPresets(dir).map(x=>x.name),['Guardado']);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('se rechazan presets inválidos antes de modificar el archivo persistente',()=>{
  const dir=mkdtempSync(join(tmpdir(),'stdq-styles-invalid-'));
  try{
    assert.throws(()=>mutateStudioPresets({action:'save',preset:{id:'bad',name:'',kind:'style'}},dir));
    assert.deepEqual(readStudioPresets(dir),[]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
