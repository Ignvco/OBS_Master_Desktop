import test from 'node:test';
import assert from 'node:assert/strict';
import type {EditorialComponentConfig} from '../types/index.ts';
import {creativeComposition,creativeRecipes} from '../utils/creativeCompositions.ts';
import {safeShapeStyle,customTypographyStyle,isHexColor,clampDesignNumber} from '../utils/creativeStyles.ts';

const original=():EditorialComponentConfig=>({
  id:'waiting',type:'waiting',name:'Espera',visibleInOBS:false,content:{title:'COMENZAMOS EN BREVE',subtitle:'Si Te Dijera Que?'},
  font:{family:'Plus Jakarta Sans',size:56,weight:800,lineHeight:1.1,letterSpacing:0,color:'#fff',textTransform:'uppercase',align:'center'},
  geometry:{x:0,y:0,width:1920,height:1080,scale:1,rotation:0,opacity:1,borderRadius:0,borderWidth:0,borderColor:'transparent',backgroundColor:'#111111',boxShadow:'none',padding:50},
  animation:{preset:'apple-spring',entryDurationMs:400,exitDurationMs:250,delayMs:0,easing:'linear',staggerWords:false,direction:'up',loopPulse:false},
  layers:[{id:'manual',kind:'image',name:'Mi logo',assetUrl:'/api/station/assets/logo.png',x:20,y:20,width:100,height:100,rotation:0,opacity:1,zIndex:30,hidden:false,locked:false}],
  layerOverrides:{headline:{color:'#FFFFFF',x:30}},updatedAt:'2026-10-19',
});
test('3 composiciones creativas disponibles',()=>assert.deepEqual(creativeRecipes.map(r=>r.id),['cinema','impact','blank']));
test('composición no elimina capas existentes ni modifica el objeto original',()=>{
  const old=original();const patch=creativeComposition(old,'cinema');
  assert.equal(old.layers?.length,1);
  assert.equal(old.layerOverrides?.headline.hidden,undefined);
  assert.equal(patch.layers?.[0].id,'manual');
  assert.ok((patch.layers?.length??0)>=5);
  assert.equal(patch.layerOverrides?.headline.hidden,true);
  assert.equal(patch.layerOverrides?.headline.color,'#FFFFFF');
  assert.equal(patch.layerOverrides?.badge.hidden,false,'El contador debe permanecer visible');
  assert.equal(patch.layerOverrides?.headline.x,30);
});
test('plantillas cinemática e impacto producen formas totalmente editables',()=>{
  const start=original();
  for(const kind of ['cinema','impact'] as const){
    const next=creativeComposition(start,kind);
    const decor=next.layers?.find(x=>x.shapePreset==='blob'||x.shapePreset==='slant');
    assert.ok(decor);
    assert.equal(decor?.kind,'shape');
    assert.equal(decor?.gradientMode,'linear');
    assert.ok(next.layers?.some(x=>x.kind==='text'&&x.fontSize));
    assert.equal(next.geometry?.width,1920);
  }
});
test('lienzo libre desactiva originales pero mantiene las capas propias y no borra la marca',()=>{
  const start=original();const next=creativeComposition(start,'blank');
  assert.equal(start.branding,next.branding);
  assert.equal(next.layers,undefined);
  assert.equal(next.layerOverrides?.headline.hidden,true);
  assert.equal(next.geometry?.backgroundColor,'transparent');
});
test('una banda editorial no cambia tamaño a pantalla completa',()=>{
  const x=original();x.type='banner';x.geometry.width=1100;x.geometry.height=120;
  const patch=creativeComposition(x,'impact');
  assert.equal(patch.geometry?.width,1100);assert.equal(patch.geometry?.height,120);
  assert.ok(patch.layers?.some(l=>l.name==='Título editorial'));
});
test('estilos crean siluetas y degradados reales',()=>{
  const s=safeShapeStyle({shapePreset:'hexagon',gradientMode:'linear',gradientFrom:'#FF6B00',gradientTo:'#112233',gradientAngle:65,shadowPreset:'glow',borderWidth:2,borderColor:'#FFFFFF'});
  assert.match(String(s.clipPath),/polygon/);
  assert.match(String(s.backgroundImage),/linear-gradient\(65deg/);
  assert.match(String(s.boxShadow),/35px/);
  assert.equal(s.borderWidth,2);
  assert.equal(safeShapeStyle({shapePreset:'pill'}).borderRadius,9999);
  assert.equal(safeShapeStyle({shapePreset:'rectangle'}).borderRadius,undefined,'La forma rectangular conserva su radio propio');
});
test('tipografía de capa respeta alineación, tracking y caja',()=>{
  const l={...original().layers![0],kind:'text' as const,fontFamily:'Barlow Condensed',textAlign:'center' as const,lineHeight:1.4,letterSpacing:2,textTransform:'uppercase' as const};
  const s=customTypographyStyle(l);assert.equal(s.fontFamily,'Barlow Condensed');assert.equal(s.justifyContent,'center');assert.equal(s.letterSpacing,'2px');
});
test('entrada HEX y límites numéricos validados antes de guardar',()=>{
  assert.equal(isHexColor('#Aa00BB'),true);
  assert.equal(isHexColor('linear-gradient(red,blue)'),false);
  assert.equal(isHexColor('#fff'),false);
  assert.equal(clampDesignNumber(Infinity,0,100),0);
  assert.equal(clampDesignNumber(500,0,100),100);
});
