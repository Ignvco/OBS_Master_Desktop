import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE } from './fixtures/bannerTemplate.ts';
import {createCustomGraphic,createBlankGraphic,addCustomGraphic,removeCustomGraphic,customOverlayPath,defaultCustomSourceName,matchesCustomOverlayUrl,isCustomRegistry,MAX_CUSTOM_COMPONENTS} from '../utils/componentRegistry.ts';

test('duplicar una plantilla crea un documento independiente sin cambiar el original',()=>{
  const original=TEMPLATE;
  const originalPhrase=original.content.phrase;
  const copy=createCustomGraphic(original,'Banner Invitado');
  assert.equal(copy.type,'banner');
  assert.notEqual(copy.id,original.id);
  assert.equal(copy.instanceId,copy.id);
  assert.equal(copy.visibleInOBS,false);
  copy.content.phrase='Invitado nuevo';
  assert.equal(original.content.phrase,originalPhrase);
  assert.equal(copy.name,'Banner Invitado');
  assert.equal(isCustomRegistry({[copy.instanceId!]:copy}),true);
});

test('varias instancias tienen URLs diferentes, incluso si comparten la plantilla',()=>{
  const a=createCustomGraphic(TEMPLATE,'Banner A');
  const b=createCustomGraphic(TEMPLATE,'Banner B');
  assert.notEqual(a.instanceId,b.instanceId);
  assert.notEqual(customOverlayPath(a.instanceId!),customOverlayPath(b.instanceId!));
  assert.notEqual(defaultCustomSourceName(a.instanceId!),defaultCustomSourceName(b.instanceId!));
});

test('enlaces de OBS deben apuntar al ID exacto, y solo a origen local',()=>{
  const a=createCustomGraphic(TEMPLATE,'Banner A');
  const b=createCustomGraphic(TEMPLATE,'Banner B');
  const url='http://localhost:3000'+customOverlayPath(a.instanceId!);
  assert.equal(matchesCustomOverlayUrl(url,a.instanceId!),true);
  assert.equal(matchesCustomOverlayUrl(url.replace('localhost','127.0.0.1'),a.instanceId!),true);
  assert.equal(matchesCustomOverlayUrl(url,b.instanceId!),false);
  assert.equal(matchesCustomOverlayUrl(`https://external.example${customOverlayPath(a.instanceId!)}`,a.instanceId!),false);
  assert.equal(matchesCustomOverlayUrl(`file:///${customOverlayPath(a.instanceId!)}`,a.instanceId!),false);
  assert.equal(matchesCustomOverlayUrl('http://localhost:3000/?overlay=banner',a.instanceId!),false);
});

test('las gráficas personalizadas no permiten borrado cuando están al aire',()=>{
  const a=createCustomGraphic(({...TEMPLATE,type:'logo-bug'}),'Mosca + LIVE');
  const registry=addCustomGraphic({},a);
  assert.throws(()=>removeCustomGraphic({...registry,[a.instanceId!]:{...a,visibleInOBS:true}},a.instanceId!),/Retira esta gráfica/);
  assert.deepEqual(removeCustomGraphic(registry,a.instanceId!),{});
});

test('el registro rechaza objetos corruptos y evita desbordar el límite',()=>{
  const a=createCustomGraphic(TEMPLATE,'Uno');
  assert.equal(isCustomRegistry({invalid:a}),false);
  assert.equal(isCustomRegistry({[a.instanceId!]:{...a,instanceId:'otro'}}),false);
  assert.equal(isCustomRegistry({[a.instanceId!]:{...a,type:'video-camera'}}),false);
  assert.equal(isCustomRegistry([]),false);
  const registry=Object.fromEntries(Array.from({length:MAX_CUSTOM_COMPONENTS},()=>{
    const g=createCustomGraphic(TEMPLATE,'Elemento');
    return [g.instanceId!,g];
  }));
  assert.equal(isCustomRegistry(registry),true);
  assert.throws(()=>addCustomGraphic(registry,createCustomGraphic(TEMPLATE,'Extra')),/Máximo/);
});

test('lienzo vacío oculta todos los originales, pero conserva capas editables',()=>{
  const blank=createBlankGraphic({...TEMPLATE,type:'editorial'},'Diseño desde cero');
  assert.equal(blank.type,'editorial');
  assert.equal(blank.visibleInOBS,false);
  assert.equal(blank.geometry.backgroundColor,'transparent');
  assert.equal(blank.layers?.length,1);
  assert.equal(blank.layers?.[0].kind,'text');
  assert.ok(Object.values(blank.layerOverrides||{}).every(value=>value.hidden===true));
});
