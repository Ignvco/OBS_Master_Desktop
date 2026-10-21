import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizeSocialNetworks, socialPillNetworkAt, SOCIAL_PLATFORMS} from '../utils/socialPill.ts';
import {templateLayerProps,templateLayersFor} from '../utils/graphicLayers.ts';
import {safeShapeStyle} from '../utils/creativeStyles.ts';

const SRC=(name:string)=>readFileSync(resolve(process.cwd(),name),'utf8');

test('V3.8 conserva redes existentes como objetos y con IDs estables',()=>{
 const data=normalizeSocialNetworks([
  {platform:'instagram',label:'Instagram',handle:'@marca'},
  {id:'yt',platform:'youtube',label:'YT',handle:'Canal'},
 ]);
 assert.deepEqual(data.map(x=>x.platform),['instagram','youtube']);
 assert.deepEqual(data.map(x=>x.handle),['@marca','Canal']);
 assert.equal(data[1].id,'yt');
});
test('V3.8 redes dañadas no se tratan como texto del usuario ni destruyen otras filas',()=>{
 const data=normalizeSocialNetworks(['[object Object]',null,{platform:'spotify',handle:'Podcast'}]);
 assert.equal(data.length,1);assert.equal(data[0].platform,'spotify');
 assert.equal(normalizeSocialNetworks(['roto']).length,1);
 assert.equal(normalizeSocialNetworks(['roto'])[0].platform,'instagram');
});
test('V3.8 rotación sincronizable usando el mismo instante en editor y OBS',()=>{
 const content={networks:[
  {id:'i',platform:'instagram',handle:'@i'},
  {id:'y',platform:'youtube',handle:'@y'},
  {id:'s',platform:'spotify',handle:'@s'},
 ],rotationMode:'rotate' as const,rotationIntervalSeconds:6,rotationEpochMs:1000};
 assert.equal(socialPillNetworkAt(content,1000).id,'i');
 assert.equal(socialPillNetworkAt(content,6999).id,'i');
 assert.equal(socialPillNetworkAt(content,7000).id,'y');
 assert.equal(socialPillNetworkAt(content,13000).id,'s');
 assert.equal(socialPillNetworkAt(content,19000).id,'i');
});
test('V3.8 modo fijo respeta red elegida e intervalo desconocido está limitado',()=>{
 const networks=[{id:'ig',platform:'instagram',handle:'@i'}, {id:'yt',platform:'youtube',handle:'@y'}];
 assert.equal(socialPillNetworkAt({networks,rotationMode:'fixed',activeId:'yt'},90000).id,'yt');
 assert.equal(socialPillNetworkAt({networks,activeNetwork:'youtube'},90000).id,'yt');
 assert.equal(socialPillNetworkAt({networks,activeId:'yt',activeNetwork:'instagram'},90000).id,'yt');
 assert.equal(socialPillNetworkAt({networks,rotationMode:'rotate',rotationIntervalSeconds:0,rotationEpochMs:0},1999).id,'ig');
 assert.ok(SOCIAL_PLATFORMS.includes('spotify'));
});
test('V3.8 estilos tipográficos originales se aplican, incluso valores en cero',()=>{
 const props=templateLayerProps({layerOverrides:{headline:{fontFamily:'Barlow Condensed',letterSpacing:0,lineHeight:1.3,textAlign:'right',textTransform:'uppercase',borderWidth:0}}},'headline');
 assert.equal(props.style.fontFamily,'Barlow Condensed');
 assert.equal(props.style.letterSpacing,'0px');
 assert.equal(props.style.lineHeight,1.3);
 assert.equal(props.style.textAlign,'right');
 assert.equal(props.style.textTransform,'uppercase');
 assert.equal(safeShapeStyle({shadowPreset:'none'}).boxShadow,'none');
 assert.equal(safeShapeStyle({borderWidth:0}).borderWidth,0);
 assert.equal(safeShapeStyle({gradientMode:'none'}).backgroundImage,'none');
});
test('V3.8 partes originales independientes Mosca y Social Pill',()=>{
 const mosca=templateLayersFor('logo-bug').map(x=>x.id);
 for (const id of ['logo','headline','badge','accent']) assert.ok(mosca.includes(id));
 const social=templateLayersFor('social-pill').map(x=>x.id);
 for (const id of ['icon','headline','badge']) assert.ok(social.includes(id));
});
test('V3.8 interruptores planos afectan toda la gráfica, sin forzar fondo transparente',()=>{
 const css=SRC('src/index.css');
 assert.match(css,/\.stdq-flat, \.stdq-flat \*/);
 assert.match(css,/box-shadow: none !important/);
 assert.match(css,/text-shadow: none !important/);
 assert.match(css,/\.stdq-no-borders/);
 const editor=SRC('src/components/studio/ComponentGeometryInspector.tsx');
 assert.match(editor,/flatMode/);assert.match(editor,/hideBorders/);
});
test('V3.8 contenido estructurado no se serializa a texto y Social Pill dispone de edición individual',()=>{
 const studio=SRC('src/components/spaces/ContentStudioSpace.tsx');
 assert.match(studio,/SocialNetworksEditor/);
 assert.match(studio,/contentFieldsFor/);
 assert.match(studio,/parseContentValue/);
 assert.doesNotMatch(studio,/Object.entries\(selectedConfig.content\)/);
 const editor=SRC('src/components/studio/SocialNetworksEditor.tsx');
 assert.match(editor,/Añadir red social/);
 assert.match(editor,/Eliminar/);
 assert.match(editor,/Subir/);
});
test('V3.8 editor y OBS comparten render con Mosca simultánea y rotación Social Pill',()=>{
 const renderer=SRC('src/components/overlays/GraphicComponentRenderers.tsx');
 assert.match(renderer,/socialPillNetworkAt\(content, socialNow\)/);
 assert.match(renderer,/content\.showLiveBadge !== false/);
 assert.match(renderer,/content\.showProgramTitle/);
 assert.match(renderer,/data-stdq-layer="logo"/);
 assert.match(renderer,/layer\('icon'\)/);
 assert.match(renderer,/\(item\.text \?\? \(isCanvasPreview/);
});
