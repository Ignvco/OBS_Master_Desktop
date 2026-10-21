import type { ComponentType, CustomComponentRegistry, EditorialComponentConfig } from '../types/index.ts';
import {templateLayersFor,makeGraphicLayer} from './graphicLayers.ts';

export const MAX_CUSTOM_COMPONENTS = 48;
export const CUSTOM_ID_PATTERN = /^gfx-[a-f0-9]{24,32}$/;

/** Independent graphic documents. Legacy templates are deliberately not mutated. */
export function createCustomGraphic(
  base: EditorialComponentConfig,
  name: string,
  id: string = `gfx-${crypto.randomUUID().replace(/-/g, '')}`,
): EditorialComponentConfig {
  if (!CUSTOM_ID_PATTERN.test(id)) throw new Error('Identificador de gráfica no válido');
  const label = name.trim().slice(0, 72);
  if (!label) throw new Error('Escribe un nombre para la gráfica');
  const clone = structuredClone(base);
  return {
    ...clone,
    id,
    instanceId: id,
    // Type only selects the established template renderer, never the identity.
    type: base.type as ComponentType,
    name: label,
    visibleInOBS: false,
    animationReplay: 0,
    updatedAt: new Date().toISOString(),
  };
}

/** Editable empty canvas built on the existing editorial renderer, hiding all default parts. */
export function createBlankGraphic(base:EditorialComponentConfig,name:string):EditorialComponentConfig {
  if(base.type!=='editorial')throw new Error('El lienzo vacío requiere el renderizador editorial');
  const graphic=createCustomGraphic(base,name);
  return {
    ...graphic,
    layerOverrides:Object.fromEntries(templateLayersFor('editorial').map(part=>[part.id,{hidden:true}])),
    layers:[{...makeGraphicLayer('text'),name:'Texto principal',text:'Escribe tu título',x:220,y:240,width:840,height:140,fontSize:72}],
    branding:graphic.branding?{...graphic.branding,visible:false}:undefined,
    glyph:{...graphic.glyph,mode:'none',size:56,opacity:1,radius:0},
    geometry:{...graphic.geometry,backgroundColor:'transparent',flatMode:true,hideBorders:true,boxShadow:'none',borderWidth:0},
  };
}

export function validateCustomGraphic(id: string, raw: unknown): raw is EditorialComponentConfig {
  if (!CUSTOM_ID_PATTERN.test(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const config = raw as Partial<EditorialComponentConfig>;
  return config.id === id && config.instanceId === id && typeof config.name === 'string'
    && config.name.trim().length > 0 && config.name.length <= 72
    && (!('layerOrder' in config) || (Array.isArray(config.layerOrder) && config.layerOrder.length<=400 && config.layerOrder.every(v=>typeof v==='string'&&v.length>=1&&v.length<=100)))
    && typeof config.visibleInOBS === 'boolean'
    && typeof config.font === 'object' && config.font !== null && !Array.isArray(config.font)
    && typeof config.type === 'string'
    && ['banner','lower-third','chapter','section','question','quote','scripture','social','social-pill','logo-bug','ticker','editorial','waiting','break','outro'].includes(config.type)
    && typeof config.content === 'object' && config.content !== null && !Array.isArray(config.content)
    && typeof config.geometry === 'object' && config.geometry !== null
    && typeof config.animation === 'object' && config.animation !== null;
}

export function isCustomRegistry(raw: unknown): raw is CustomComponentRegistry {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const entries = Object.entries(raw);
  return entries.length <= MAX_CUSTOM_COMPONENTS && entries.every(([id, value]) => validateCustomGraphic(id, value));
}

export function addCustomGraphic(registry: CustomComponentRegistry, graphic: EditorialComponentConfig): CustomComponentRegistry {
  if (!graphic.instanceId || !validateCustomGraphic(graphic.instanceId, graphic)) throw new Error('La gráfica no tiene una identidad válida');
  if (!registry[graphic.instanceId] && Object.keys(registry).length >= MAX_CUSTOM_COMPONENTS) throw new Error(`Máximo ${MAX_CUSTOM_COMPONENTS} gráficas personalizadas`);
  return {...registry, [graphic.instanceId]: graphic};
}

export function removeCustomGraphic(registry: CustomComponentRegistry, id: string): CustomComponentRegistry {
  if (!registry[id]) return registry;
  if (registry[id].visibleInOBS) throw new Error('Retira esta gráfica del aire antes de eliminarla');
  const copy = {...registry}; delete copy[id]; return copy;
}

export function customOverlayPath(id: string): string {
  if (!CUSTOM_ID_PATTERN.test(id)) throw new Error('URL inválida para gráfica personalizada');
  return `/?overlayId=${encodeURIComponent(id)}`;
}

/** Never let a custom graphic control an unrelated OBS Browser Source. */
export function matchesCustomOverlayUrl(rawUrl:string, id:string):boolean {
  if (!CUSTOM_ID_PATTERN.test(id)) return false;
  try {
    const url=new URL(rawUrl);
    return url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
      && url.pathname==='/' && url.searchParams.get('overlayId')===id;
  } catch { return false; }
}

export function defaultCustomSourceName(id:string):string {
  if (!CUSTOM_ID_PATTERN.test(id)) throw new Error('ID de gráfica inválido');
  return `STDQ_GFX_${id.slice(-12).toUpperCase()}`;
}
