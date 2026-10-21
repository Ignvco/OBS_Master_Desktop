import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CONTENT_FIELDS,contentFieldsFor,parseContentValue,contentField} from '../utils/contentSchema.ts';
import {templateLayersFor} from '../utils/graphicLayers.ts';

const source=(file:string)=>readFileSync(resolve(process.cwd(),file),'utf8');
const RENDER=source('src/components/overlays/GraphicComponentRenderers.tsx');
const INITIAL=source('src/constants/initialData.ts');
const STUDIO=source('src/components/spaces/ContentStudioSpace.tsx');
const ALL_TYPES=Object.keys(CONTENT_FIELDS);
const CONTENT_KEYS: Record<string,string[]>={
  banner:['category','phrase','author'],
  'lower-third':['name','role','handle','badge'],
  chapter:['episodeBadge','title','subtitle'],
  section:['badge','title','detail'],
  question:['tag','question','instructions'],
  quote:['quote','author','source'],
  scripture:['reference','text','version'],
  social:['title','instagram','youtube','spotify','web'],
  'social-pill':['activeNetwork','rotationMode','badgeText','showBadge','networks','rotationIntervalSeconds'],
  'logo-bug':['showLiveBadge','showProgramTitle','showIcon','liveText','programTitle','opacity'],
  ticker:['tag','items','speedSeconds','tickerDirection','tickerPaused'],
  editorial:['kicker','title','caption','date'],
  waiting:['title','subtitle','showCountdown','message'],
  break:['title','subtitle','message','showCountdown'],
  outro:['title','subtitle','credits','social'],
};
test('RC2 manifiesto cubre los 15 tipos y sus propiedades conocidas',()=>{
 assert.equal(ALL_TYPES.length,15);
 assert.deepEqual(ALL_TYPES.sort(),Object.keys(CONTENT_KEYS).sort());
 for (const [type,keys] of Object.entries(CONTENT_KEYS)) {
  const manifest=CONTENT_FIELDS[type as keyof typeof CONTENT_FIELDS];
  const seen=new Set(manifest.map(x=>x.key));
  assert.equal(seen.size,manifest.length,`Campo duplicado en ${type}`);
  for(const key of keys) assert.ok(seen.has(key),`Sin inspector para ${type}.${key}`);
 }
 assert.match(INITIAL,/INITIAL_COMPONENTS/);
});
test('RC2 campos vinculados incluyen destino visual y todo destino existe en capas',()=>{
 for(const type of ALL_TYPES){
  const ids=new Set(templateLayersFor(type as keyof typeof CONTENT_FIELDS).map(x=>x.id));
  for(const f of CONTENT_FIELDS[type as keyof typeof CONTENT_FIELDS]){
   if(f.target) assert.ok(ids.has(f.target),`${type}.${f.key} → ${f.target} no existe`);
  }
 }
});
test('RC2 cada capa estructural añadida existe como nodo en el renderizador',()=>{
 for(const id of ['live-label','question-icon','status-dot','quote-icon','author-row','heading','heading-icon','instagram-icon','youtube-icon','ticker-icon','heading-row']){
  assert.ok(RENDER.includes(`layer('${id}')`),`No se renderiza ${id}`);
 }
 assert.ok(RENDER.includes(`layer('message')`));
});
test('RC2 campo estructurado Social Pill no admite serialización genérica',()=>{
 assert.equal(contentField('social-pill','networks')?.kind,'networks');
 assert.throws(()=>parseContentValue(contentField('social-pill','networks')!,['[@object Object]']));
 assert.deepEqual(contentFieldsFor('social-pill',{networks:[{id:'x'}],rotationMode:'fixed'}).editable,[]);
 assert.match(STUDIO,/SocialNetworksEditor/);
});
test('RC2 texto vacío se conserva y valores de lista se normalizan sin mutar su entrada',()=>{
 const text=contentField('banner','phrase')!;
 assert.equal(parseContentValue(text,''),'');
 assert.deepEqual(parseContentValue(contentField('ticker','items')!,'Uno\nDos'),['Uno','Dos']);
 const array=['A','B'];assert.deepEqual(parseContentValue(contentField('ticker','items')!,array),array);
 assert.deepEqual(array,['A','B']);
});
test('RC2 números y opciones tienen validaciones explícitas',()=>{
 const speed=contentField('ticker','speedSeconds')!;
 assert.equal(parseContentValue(speed,'1'),3);
 assert.equal(parseContentValue(speed,'3000'),240);
 assert.throws(()=>parseContentValue(speed,'inválido'));
 assert.equal(parseContentValue(contentField('ticker','tickerDirection')!,'right'),'right');
 assert.throws(()=>parseContentValue(contentField('ticker','tickerDirection')!,'vertical'));
});
test('RC2 los campos importados sin binding no se presentan falsamente como controles activos',()=>{
 const result=contentFieldsFor('banner',{phrase:'Texto',unmappedLegacyValue:'sorpresa'});
 assert.deepEqual(result.unknown,['unmappedLegacyValue']);
 assert.ok(result.editable.some(f=>f.key==='phrase'));
 assert.match(STUDIO,/Campos heredados conservados sin edición directa/);
});
test('RC2 opciones de cita e indicador no dañan los diseños heredados',()=>{
 assert.match(RENDER,/content\.showQuotationMarks === false/);
 assert.match(RENDER,/content\.showQuoteIcon !== false/);
 assert.match(RENDER,/content\.showLiveLabel !== false/);
 assert.match(RENDER,/content\.showStatusDot !== false/);
 assert.match(RENDER,/content\.showHeadingIcon !== false/);
 assert.match(RENDER,/content\.heading \?\?/);
});
test('RC2 todos los tipos tienen etiquetas legibles y tipos de control definidos',()=>{
 for(const type of ALL_TYPES){
  for(const spec of CONTENT_FIELDS[type as keyof typeof CONTENT_FIELDS]){
   assert.ok(spec.label.trim().length>1,`${type}.${spec.key} sin etiqueta`);
   assert.ok(['text','multiline','toggle','integer','choice','lines','networks'].includes(spec.kind));
  }
 }
});

test('RC2 cada campo inicial tiene consumidor visual o motor específico',()=>{
 const socialEngine=source('src/utils/socialPill.ts');
 const tickerEngine=source('src/components/overlays/TickerMarquee.tsx');
 const editorSocial=source('src/components/studio/SocialNetworksEditor.tsx');
 for(const [type,keys] of Object.entries(CONTENT_KEYS)){
  for(const key of keys){
   const referenced=RENDER.includes(`content.${key}`) || socialEngine.includes(`content.${key}`) || tickerEngine.includes(`content.${key}`) || (type==='social-pill'&&editorSocial.includes(`content.${key}`));
   assert.ok(referenced,`${type}.${key} está en datos iniciales pero no tiene consumidor identificado`);
  }
 }
});
test('RC2 los nuevos elementos y contadores son independientes',()=>{
 for(const type of ['question','scripture','editorial']){
   assert.ok(templateLayersFor(type as keyof typeof CONTENT_FIELDS).some(x=>x.id==='heading-row'));
 }
 for(const type of ['waiting','break']){
   const ids=templateLayersFor(type as keyof typeof CONTENT_FIELDS).map(x=>x.id);
   assert.ok(ids.includes('countdown-digits')&&ids.includes('badge'));
 }
 const quote=templateLayersFor('quote').map(x=>x.id);
 assert.ok(quote.includes('quote-icon'));
 assert.ok(quote.includes('author-row'));
});
test('RC2 sin sombra por capa también limpia sombra de texto',()=>{
 const styles=source('src/utils/creativeStyles.ts');
 assert.match(styles,/textShadow:data.shadowPreset==='none'\?'none'/);
 const panel=source('src/components/spaces/LayerEditorPanel.tsx');
 assert.match(panel,/Quitar sombra de ESTA capa/);
 assert.match(panel,/Restablecer estilos de esta pieza original/);
});
