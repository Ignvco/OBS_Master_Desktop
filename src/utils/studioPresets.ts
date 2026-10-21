import type {EditorialComponentConfig, GraphicLayer, LayerOverride, ComponentType} from '../types/index.ts';
import {editableTemplateLayersFor} from './graphicLayers.ts';

export const MAX_STUDIO_PRESETS=100;
export type StudioPreset = {
  id: string;
  name: string;
  kind: 'style'|'composition';
  createdAt: string;
  sourceType?: ComponentType;
  style?: Partial<LayerOverride>;
  composition?: Pick<EditorialComponentConfig,'content'|'font'|'geometry'|'animation'|'layerOverrides'|'layers'|'layerOrder'|'branding'|'glyph'>;
};
/** Only visual properties: never copy layer identity, position, content, asset or OBS visibility. */
export const STYLE_KEYS = [
  'color','backgroundColor','opacity','borderRadius','borderWidth','borderColor',
  'shapePreset','gradientMode','gradientFrom','gradientTo','gradientAngle',
  'shadowPreset','blendMode','fontFamily','fontSize','fontWeight','textAlign',
  'lineHeight','letterSpacing','textTransform','imageFit','imagePosition',
] as const;
export type LayerStyleKey=(typeof STYLE_KEYS)[number];
const styleKeys=new Set<string>(STYLE_KEYS);
const numericLimits: Record<string,[number,number]>={
  opacity:[0,1],borderRadius:[0,5000],borderWidth:[0,60],gradientAngle:[0,360],
  fontSize:[8,600],fontWeight:[100,1000],lineHeight:[0.5,4],letterSpacing:[-40,120],
};
const permitted:Record<string,string[]>={
 shapePreset:['rectangle','pill','circle','diamond','chevron','slant','ticket','hexagon','blob'],
 gradientMode:['none','linear','radial'],shadowPreset:['none','soft','lifted','glow','deep'],
 blendMode:['normal','multiply','screen','overlay'],
 textAlign:['left','center','right'],textTransform:['none','uppercase','lowercase','capitalize'],
 imageFit:['contain','cover'],imagePosition:['center','top','bottom','left','right']
};
/** Strict whitelist blocks inherited keys and arbitrary CSS/URL injection in saved user presets. */
export function cleanLayerStyle(value:unknown):Partial<LayerOverride>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const source=value as Record<string,unknown>;
  const result:Record<string,unknown>={};
  for(const [key,v] of Object.entries(source)){
    if(!styleKeys.has(key))continue;
    if(key in numericLimits){
      const [min,max]=numericLimits[key];
      if(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max)result[key]=v;
    }else if(key==='fontFamily'){
      if(typeof v==='string'&&v.length<=80&&!/[<>\\]/.test(v))result[key]=v;
    }else if(['color','backgroundColor','borderColor','gradientFrom','gradientTo'].includes(key)){
      if(typeof v==='string'&&(/^#[0-9a-fA-F]{6}$/.test(v)||v==='transparent'))result[key]=v;
    }else if(permitted[key]){
      if(typeof v==='string'&&permitted[key].includes(v))result[key]=v;
    }
  }
  return result as Partial<LayerOverride>;
}
export function captureLayerStyle(config:EditorialComponentConfig,id:string):Partial<LayerOverride>{
  const layer=config.layers?.find(l=>l.id===id);
  if(layer)return cleanLayerStyle(layer);
  const original=editableTemplateLayersFor(config).find(x=>x.id===id);
  const defaults=original?.contentKey?{
    color:config.font.color,fontSize:config.font.size,fontWeight:config.font.weight,
    fontFamily:config.font.family,textAlign:config.font.align,
    lineHeight:config.font.lineHeight,letterSpacing:config.font.letterSpacing,
    textTransform:config.font.textTransform
  }:{};
  return cleanLayerStyle({...defaults,...config.layerOverrides?.[id]});
}
export function applyStyleToSelection(config:EditorialComponentConfig,ids:string[],style:Partial<LayerOverride>):Partial<EditorialComponentConfig>{
  const cleaned=cleanLayerStyle(style);
  const targets=new Set(ids);
  const template=new Set(editableTemplateLayersFor(config).map(x=>x.id));
  const layerOverrides={...config.layerOverrides};
  for(const id of targets){
    if(!template.has(id)||layerOverrides[id]?.locked)continue;
    layerOverrides[id]={...layerOverrides[id],...cleaned};
  }
  const layers=(config.layers??[]).map(layer=>{
    if(!targets.has(layer.id)||layer.locked)return layer;
    const patch={...cleaned};
    if(layer.kind!=='text'){
      delete patch.fontFamily;delete patch.fontSize;delete patch.fontWeight;delete patch.textAlign;
      delete patch.lineHeight;delete patch.letterSpacing;delete patch.textTransform;
    }
    if(layer.kind!=='image'){
      delete patch.imageFit;delete patch.imagePosition;
    }
    return {...layer,...patch} as GraphicLayer;
  });
  return {layerOverrides,layers};
}
export function updateSelectionProperty(config:EditorialComponentConfig,ids:string[],property:keyof LayerOverride,value:unknown):Partial<EditorialComponentConfig>{
  const idSet=new Set(ids);
  const overrides={...config.layerOverrides};
  const originals=new Set(editableTemplateLayersFor(config).map(l=>l.id));
  for(const id of idSet){
    if(originals.has(id)&&!overrides[id]?.locked)overrides[id]={...overrides[id],[property]:value};
  }
  return {layerOverrides:overrides,layers:(config.layers??[]).map(layer=>idSet.has(layer.id)&&!layer.locked?{...layer,[property]:value}:layer)};
}
export function compositionSnapshot(config:EditorialComponentConfig):NonNullable<StudioPreset['composition']>{
  return {
    content:structuredClone(config.content),font:structuredClone(config.font),
    geometry:structuredClone(config.geometry),animation:structuredClone(config.animation),
    layerOverrides:structuredClone(config.layerOverrides??{}),layers:structuredClone(config.layers??[]),
    ...(config.layerOrder?{layerOrder:structuredClone(config.layerOrder)}:{}),
    ...(config.branding?{branding:structuredClone(config.branding)}:{}),
    ...(config.glyph?{glyph:structuredClone(config.glyph)}:{})
  };
}
export function applyCompositionPreset(config:EditorialComponentConfig,preset:StudioPreset):Partial<EditorialComponentConfig>{
  if(preset.kind!=='composition'||preset.sourceType!==config.type||!preset.composition)
    throw new Error('Composición incompatible con el componente seleccionado');
  // Never replace identity, visibility, timestamps or station connection state.
  return {...structuredClone(preset.composition),layerOrder:preset.composition.layerOrder,branding:preset.composition.branding,glyph:preset.composition.glyph};
}
export function validStudioPreset(input:unknown):input is StudioPreset{
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const x=input as StudioPreset;
  if(!/^[a-zA-Z0-9_-]{6,90}$/.test(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>70||
    !['style','composition'].includes(x.kind)||typeof x.createdAt!=='string'||Number.isNaN(Date.parse(x.createdAt)))return false;
  if(x.kind==='style')return !!x.style&&typeof x.style==='object'&&!Array.isArray(x.style)&&Object.keys(cleanLayerStyle(x.style)).length>0;
  if(x.kind==='composition'){
    const c=x.composition;
    return typeof x.sourceType==='string'&&!!c&&typeof c.content==='object'&&!!c.font&&!!c.geometry&&!!c.animation
      &&(!c.layerOrder||(Array.isArray(c.layerOrder)&&c.layerOrder.length<=400&&c.layerOrder.every(id=>typeof id==='string'&&id.length<100)))
      &&JSON.stringify(c).length<=180_000;
  }
  return false;
}
