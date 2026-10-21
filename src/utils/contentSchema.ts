/**
 * Content Studio RC2: auditable content-to-renderer contract.
 * Every editable field has a label, value kind and destination layer.
 * This is deliberately separate from dynamic graphic registration (V3.9).
 */
import type { ComponentType } from '../types/index.ts';

export type ContentValueKind = 'text' | 'multiline' | 'toggle' | 'integer' | 'choice' | 'lines' | 'networks';
export interface ContentField {
  key: string;
  label: string;
  kind: ContentValueKind;
  target?: string;
  description?: string;
  min?: number;
  max?: number;
  options?: readonly {value: string; label: string}[];
}
const field = (key:string,label:string,kind:ContentValueKind='text',target?:string,description?:string):ContentField => ({key,label,kind,target,description});
const bool = (key:string,label:string,target?:string):ContentField => field(key,label,'toggle',target);
const number = (key:string,label:string,target:string|undefined,min:number,max:number):ContentField => ({key,label,kind:'integer',target,min,max});
const select = (key:string,label:string,options:readonly {value:string;label:string}[],target?:string):ContentField => ({key,label,kind:'choice',options,target});

export const CONTENT_FIELDS: Record<ComponentType,readonly ContentField[]> = {
  banner:[field('category','Categoría','text','kicker'),field('phrase','Frase principal','multiline','headline'),field('author','Autor','text','author')],
  'lower-third':[field('name','Nombre','text','headline'),field('role','Cargo o rol','text','subtitle'),field('handle','Usuario / red','text','handle'),field('badge','Etiqueta','text','badge')],
  chapter:[field('episodeBadge','Distintivo episodio','text','badge'),field('title','Título de capítulo','multiline','headline'),field('subtitle','Descripción','multiline','subtitle')],
  section:[field('badge','Etiqueta superior','text','badge'),field('title','Título','text','headline'),field('detail','Detalle','multiline','subtitle')],
  question:[field('tag','Etiqueta','text','kicker'),field('question','Pregunta','multiline','headline'),field('instructions','Instrucciones','multiline','subtitle'),field('liveLabel','Texto indicador en vivo','text','live-label'),bool('showLiveLabel','Mostrar indicador en vivo','live-label'),bool('showStatusDot','Mostrar punto de estado','status-dot')],
  quote:[field('quote','Cita','multiline','headline'),field('author','Autor','text','subtitle'),field('source','Origen','text','kicker'),bool('showQuotationMarks','Mostrar comillas','headline'),bool('showQuoteIcon','Mostrar símbolo de cita','quote-icon')],
  scripture:[field('reference','Referencia','text','kicker'),field('text','Versículo','multiline','headline'),field('version','Versión','text','subtitle'),field('heading','Texto de cabecera','text','heading'),bool('showHeadingIcon','Mostrar icono de cabecera','heading-icon'),bool('showQuotationMarks','Mostrar comillas','headline')],
  social:[field('title','Título','text','headline'),field('instagram','Instagram','text','kicker'),field('youtube','YouTube','text','subtitle'),field('spotify','Spotify','text','spotify'),field('web','Sitio web','text','web')],
  'social-pill':[select('activeNetwork','Red activa',[{value:'instagram',label:'Instagram'},{value:'youtube',label:'YouTube'}]),select('rotationMode','Rotación',[{value:'fixed',label:'Fija'},{value:'rotate',label:'Rotativa'}]),field('badgeText','Texto de etiqueta','text','badge'),bool('showBadge','Mostrar etiqueta','badge'),field('networks','Redes configuradas','networks','headline'),number('rotationIntervalSeconds','Segundos por red',undefined,2,120),number('rotationEpochMs','Inicio de rotación',undefined,0,Number.MAX_SAFE_INTEGER),field('activeId','ID activo','text')],
  'logo-bug':[bool('showLiveBadge','Mostrar EN VIVO','badge'),bool('showProgramTitle','Mostrar nombre del programa','headline'),bool('showIcon','Mostrar icono','accent'),field('liveText','Texto en vivo','text','badge'),field('programTitle','Nombre del programa','text','headline'),number('opacity','Opacidad global (%)',undefined,0,100)],
  ticker:[field('tag','Etiqueta','text','badge'),field('items','Noticias','lines','headline'),number('speedSeconds','Velocidad de la cinta (segundos)', 'headline',3,240),select('tickerDirection','Dirección',[{value:'left',label:'Izquierda'},{value:'right',label:'Derecha'}],'headline'),bool('tickerPaused','Pausar cinta','headline')],
  editorial:[field('kicker','Cabecera','text','kicker'),field('title','Título editorial','multiline','headline'),field('caption','Descripción','multiline','subtitle'),field('date','Fecha o edición','text','badge')],
  waiting:[field('title','Título','text','headline'),field('subtitle','Subtítulo','multiline','subtitle'),bool('showCountdown','Mostrar contador','badge'),field('message','Mensaje del contador','text','message')],
  break:[field('title','Título','text','headline'),field('subtitle','Subtítulo','text','subtitle'),field('message','Mensaje','multiline','message'),bool('showCountdown','Mostrar contador','badge')],
  outro:[field('title','Título','text','headline'),field('subtitle','Subtítulo','multiline','subtitle'),field('credits','Créditos','multiline','credits'),field('social','Redes sociales','text','kicker')],
};

/** Unknown imported keys are preserved, but not misrepresented as functional editor controls. */
export function contentFieldsFor(type: ComponentType,content:Record<string,unknown>): {editable:ContentField[];unknown:string[]} {
  const editable=CONTENT_FIELDS[type].filter(spec=>spec.kind!=='networks' && spec.key !== 'rotationEpochMs' && spec.key !== 'activeId' && !(type==='social-pill'));
  const known=new Set(CONTENT_FIELDS[type].map(f=>f.key));
  return {editable,unknown:Object.keys(content).filter(key=>!known.has(key))};
}

/** Coerce only supported content kinds; reject stale/invalid UI writes. */
export function parseContentValue(spec:ContentField,value:unknown):unknown {
  switch(spec.kind){
    case 'toggle': return Boolean(value);
    case 'integer': { const n=Number(value);if(!Number.isFinite(n)) throw new Error(`Valor no numérico para ${spec.label}`);return Math.max(spec.min??-Infinity,Math.min(spec.max??Infinity,Math.round(n))); }
    case 'choice': if(typeof value!=='string'||!spec.options?.some(x=>x.value===value))throw new Error(`Opción inválida para ${spec.label}`);return value;
    case 'lines': return (Array.isArray(value)?value: String(value).split(/\r?\n/)).filter(x=>typeof x==='string').map(x=>(x as string).slice(0,500));
    case 'multiline':case 'text': return String(value ?? '').slice(0,spec.kind==='multiline'?5000:500);
    case 'networks': throw new Error('Las redes solo pueden editarse con el editor estructurado');
  }
}

export function contentField(type:ComponentType,key:string):ContentField|undefined {return CONTENT_FIELDS[type].find(x=>x.key===key);}
