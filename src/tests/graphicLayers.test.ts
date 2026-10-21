import assert from 'node:assert/strict';
import {test} from 'node:test';
import { makeGraphicLayer, moveGraphicLayer, resizeGraphicLayer, templateLayersFor, editableTemplateLayersFor, templateLayerProps } from '../utils/graphicLayers.ts';
import type { ComponentType, EditorialComponentConfig } from '../types/index.ts';

test('todos los componentes contienen elementos originales seleccionables', () => {
  for (const key of ['banner','lower-third','chapter','section','question','quote','scripture','social','social-pill','logo-bug','ticker','editorial','waiting','break','outro'] as ComponentType[]) {
    const list=templateLayersFor(key);
    assert.ok(list.length>=2, `${key} no tiene suficientes elementos editables`);
    assert.equal(new Set(list.map(x=>x.id)).size,list.length);
  }
});
test('logotipo superpuesto es una capa reconocida solo cuando existe', () => {
  const component={type:'banner'} satisfies Pick<EditorialComponentConfig, 'type'>;
  assert.ok(!editableTemplateLayersFor(component).some(x=>x.id==='brand-logo'));
  const branded={...component,branding:{assetUrl:'/api/station/assets/00000000-0000-0000-0000-000000000000.png',visible:true,width:100,x:0,y:0,rotation:0,opacity:1}};
  assert.ok(editableTemplateLayersFor(branded).some(x=>x.id==='brand-logo'));
});
test('las posiciones de una capa se modifican sin mutar la geometría del componente', () => {
  const original={x:10,y:20,width:250,height:70};
  assert.deepEqual(moveGraphicLayer(original,14,-4),{...original,x:24,y:16});
  assert.deepEqual(original,{x:10,y:20,width:250,height:70});
  assert.deepEqual(resizeGraphicLayer(original,40,-100),{...original,width:290,height:16});
});
test('se crean capas independientes de texto, forma e imagen', () => {
  for(const kind of ['text','shape','image'] as const) {
    const element=makeGraphicLayer(kind);
    assert.equal(element.kind,kind);
    assert.equal(element.locked,false);
    assert.equal(element.hidden,false);
    assert.ok(element.id.startsWith('layer-'));
  }
});
test('la edición tipográfica se aplica sin alterar otros atributos',()=>{
  const conf={layerOverrides:{headline:{x:24,fontSize:42,color:'#FFFFFF',opacity:.6}}} satisfies Pick<EditorialComponentConfig, 'layerOverrides'>;
  const attr=templateLayerProps(conf,'headline','headline');
  assert.equal(attr['data-stdq-layer'],'headline');
  assert.equal(attr.style.fontSize,42);
  assert.equal(attr.style.translate,'24px 0px');
  assert.equal(attr.style.opacity,.6);
  assert.equal(attr.style.outline,'2px solid #FF6B00');
});

test('los identificadores de las capas originales existen en el render de OBS', async () => {
  const {readFileSync} = await import('node:fs');
  const {resolve} = await import('node:path');
  const source=readFileSync(resolve(process.cwd(),'src/components/overlays/GraphicComponentRenderers.tsx'),'utf8');
  const types=['banner','lower-third','chapter','section','question','quote','scripture','social','social-pill','logo-bug','ticker','editorial','waiting','break','outro'] as ComponentType[];
  for(const type of types) {
    const chunk=source.split(`case '${type}':`)[1]?.split(/\n\s*(?:case '|default:)/)[0];
    assert.ok(chunk,`No se encontró el renderer de ${type}`);
    for(const layer of templateLayersFor(type)) {
      assert.ok(chunk!.includes(`layer('${layer.id}')`) || chunk!.includes(`layer('${layer.id}',`) || chunk!.includes(`data-stdq-layer="${layer.id}"`),
        `La capa ${layer.id} de ${type} no está conectada al renderer`);
    }
  }
});
