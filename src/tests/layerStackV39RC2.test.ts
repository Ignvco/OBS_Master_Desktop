import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {EditorialComponentConfig} from '../types/index.ts';
import {TEMPLATE} from './fixtures/bannerTemplate.ts';
import {layerStackIds,layerStackZ,stepLayerStack,dropLayerStack} from '../utils/layerStack.ts';
import {templateLayerProps} from '../utils/graphicLayers.ts';
import {compositionSnapshot,applyCompositionPreset} from '../utils/studioPresets.ts';
import {createHistory,pushHistory,stepHistory} from '../utils/editorHistory.ts';

const make=():EditorialComponentConfig=>({...structuredClone(TEMPLATE),layers:[
  {id:'photo',kind:'image',name:'Foto',x:0,y:0,width:600,height:400,rotation:0,opacity:1,zIndex:12,hidden:false,locked:false},
  {id:'plate',kind:'shape',name:'Placa',x:0,y:0,width:600,height:400,rotation:0,opacity:1,zIndex:13,hidden:false,locked:false},
]});

test('compatibilidad: un documento antiguo conserva el orden heredado sin migración forzada',()=>{
  const config=make();
  assert.equal(config.layerOrder,undefined);
  assert.deepEqual(layerStackIds(config),['accent','kicker','headline','author','photo','plate']);
  assert.equal(layerStackZ(config,'headline'),undefined);
  assert.equal(templateLayerProps(config,'headline').style.zIndex,undefined);
});

test('mover originales y capas propias genera una secuencia única y no muta la configuración anterior',()=>{
  const config=make();
  const patch=stepLayerStack(config,'headline','up');
  assert.deepEqual(patch.layerOrder,['accent','kicker','author','headline','photo','plate']);
  assert.equal(config.layerOrder,undefined);
  const moved={...config,...patch};
  assert.equal(layerStackZ(moved,'headline'),130);
  assert.equal(layerStackZ(moved,'photo'),140);
  assert.equal(templateLayerProps(moved,'headline').style.zIndex,130);
  assert.equal(moved.layers?.[0].zIndex,12); // Legacy data is not destructively rewritten.
});

test('la capa colocada delante de otra comparte índice de pintura en editor y OBS',()=>{
  const config=make();
  const patch=dropLayerStack(config,'plate','headline');
  const next={...config,...patch};
  assert.deepEqual(layerStackIds(next),['accent','kicker','headline','plate','author','photo']);
  assert.ok(layerStackZ(next,'plate')!>layerStackZ(next,'headline')!);
  assert.ok(layerStackZ(next,'plate')!<layerStackZ(next,'author')!);
});

test('se ignoran IDs inválidos, duplicados y componentes eliminados al resolver registros antiguos',()=>{
  const config={...make(),layerOrder:['ghost','headline','headline','photo']};
  assert.deepEqual(layerStackIds(config),['headline','photo','accent','kicker','author','plate']);
  assert.equal(layerStackZ(config,'ghost'),undefined);
  assert.deepEqual(dropLayerStack(config,'bad','photo'),{});
});

test('nuevas capas se colocan arriba de las existentes sin alterar sus IDs',()=>{
  const config={...make(),layerOrder:['accent','kicker','headline','author','photo','plate']};
  const next={...config,layers:[...config.layers!,{...config.layers![0],id:'extra',name:'Nuevo'}]};
  assert.equal(layerStackIds(next).at(-1),'extra');
  assert.equal(layerStackZ(next,'extra'),160);
});

test('bloqueos impiden cambiar el orden y las capas desbloqueadas siguen operables',()=>{
  const config=make();config.layerOverrides={headline:{locked:true}};
  assert.deepEqual(stepLayerStack(config,'headline','up'),{});
  assert.deepEqual(dropLayerStack(config,'headline','plate'),{});
  assert.ok(stepLayerStack(config,'photo','up').layerOrder);
});

test('un grupo de capas se mueve junto y mantiene su orden interno',()=>{
  const config=make();config.layers![0].groupId='g';config.layers![1].groupId='g';
  const patch=stepLayerStack(config,'photo','down');
  assert.deepEqual(patch.layerOrder,['accent','kicker','headline','photo','plate','author']);
  assert.deepEqual((config.layers??[]).map(x=>x.id),['photo','plate']);
});

test('historial conserva y revierte correctamente los cambios de orden',()=>{
  const config=make();const patch=stepLayerStack(config,'headline','up');
  const history=pushHistory(createHistory(config),{...config,...patch});
  const previous=stepHistory(history,-1);
  assert.equal(previous.value?.layerOrder,undefined);
  const future=stepHistory(previous.state,1);
  assert.deepEqual(future.value?.layerOrder,patch.layerOrder);
});

test('composiciones guardadas incluyen el orden sin reemplazar la identidad de la gráfica',()=>{
  const config=make();config.layerOrder=stepLayerStack(config,'headline','up').layerOrder;
  const composition=compositionSnapshot(config);
  assert.deepEqual(composition.layerOrder,config.layerOrder);
  const replacement={...make(),id:'other',layerOrder:['plate','photo']};
  const result=applyCompositionPreset(replacement,{id:'preset-test-layerstack',kind:'composition',name:'Prueba',createdAt:new Date().toISOString(),sourceType:'banner',composition});
  assert.deepEqual(result.layerOrder,config.layerOrder);
  assert.equal(replacement.id,'other');
});

test('ambos contextos dibujan con un solo renderizador y la mosca se incorpora al mismo contexto cuando se reordena',()=>{
  const renderer=readFileSync(fileURLToPath(new URL('../components/overlays/GraphicComponentRenderers.tsx',import.meta.url)),'utf8');
  const obs=readFileSync(fileURLToPath(new URL('../components/overlays/BroadcastOverlayRenderer.tsx',import.meta.url)),'utf8');
  const studio=readFileSync(fileURLToPath(new URL('../components/spaces/ContentStudioSpace.tsx',import.meta.url)),'utf8');
  assert.match(renderer,/layerStackZ\(config,item\.id\)/);
  assert.match(renderer,/React\.cloneElement\(template/);
  assert.match(renderer,/<BrandLogoLayer config=\{config\}/);
  assert.match(obs,/<GraphicComponentRenderer config=\{stableConfig\}/);
  assert.match(studio,/<GraphicComponentRenderer config=\{(?:selectedConfig|canvasConfig)\}/);
});
