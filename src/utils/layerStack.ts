import type {EditorialComponentConfig} from '../types/index.ts';
import {editableTemplateLayersFor} from './graphicLayers.ts';

/**
 * Persisted front-to-back ordering is represented as bottom-to-top IDs.
 * Legacy components keep their original renderer ordering until the operator
 * performs an explicit stack action in Content Studio.
 */
export function layerStackIds(config: EditorialComponentConfig): string[] {
  const original=editableTemplateLayersFor(config).map(x=>x.id);
  const extra=(config.layers??[]).map(x=>x.id);
  const permitted=[...new Set([...original,...extra])];
  if (!Array.isArray(config.layerOrder)) return permitted;
  const known=new Set(permitted);
  const explicit=[...new Set(config.layerOrder.filter(id=>typeof id==='string' && known.has(id)))];
  // A newly added layer belongs at the top, never disappears because it was
  // created after a previous stack was saved.
  return [...explicit,...permitted.filter(id=>!explicit.includes(id))];
}

export function layerStackZ(config: EditorialComponentConfig,id:string):number|undefined {
  if (!Array.isArray(config.layerOrder)) return undefined;
  const index=layerStackIds(config).indexOf(id);
  return index<0 ? undefined : 100+index*10;
}

function grouped(config:EditorialComponentConfig,id:string):string[] {
  const order=layerStackIds(config);
  const key=config.layers?.find(x=>x.id===id)?.groupId ?? config.layerOverrides?.[id]?.groupId;
  if(!key)return order.includes(id)?[id]:[];
  return order.filter(x=>(config.layers?.find(l=>l.id===x)?.groupId ?? config.layerOverrides?.[x]?.groupId)===key);
}

export type LayerStackDirection='up'|'down';
/** Preserve group membership and reverse direction rules when moving layers. */
export function stepLayerStack(config:EditorialComponentConfig,id:string,direction:LayerStackDirection):Partial<EditorialComponentConfig> {
  const order=layerStackIds(config);
  const members=grouped(config,id);
  if(!members.length||members.some(x=>isLayerStackLocked(config,x)))return {};
  const moving=new Set(members);
  const available=order.filter(x=>!moving.has(x));
  const positions=members.map(x=>order.indexOf(x));
  const boundary=direction==='up'?Math.max(...positions):Math.min(...positions);
  const target=direction==='up'?order.slice(boundary+1).find(x=>!moving.has(x)):order.slice(0,boundary).reverse().find(x=>!moving.has(x));
  if(!target)return {};
  const targetIndex=available.indexOf(target);
  const insertion=direction==='up'?targetIndex+1:targetIndex;
  return {layerOrder:[...available.slice(0,insertion),...members,...available.slice(insertion)]};
}

export function dropLayerStack(config:EditorialComponentConfig,source:string,target:string):Partial<EditorialComponentConfig> {
  const order=layerStackIds(config);
  if(source===target)return {};
  const moving=grouped(config,source);
  if(!moving.length||!order.includes(target)||moving.includes(target)||moving.some(x=>isLayerStackLocked(config,x)))return {};
  const left=order.filter(x=>!moving.includes(x));
  const at=left.indexOf(target);
  // A dropped layer goes immediately above its target in the resulting stack.
  return {layerOrder:[...left.slice(0,at+1),...moving,...left.slice(at+1)]};
}

export function isLayerStackLocked(config:EditorialComponentConfig,id:string):boolean {
  return Boolean(config.layers?.find(x=>x.id===id)?.locked ?? config.layerOverrides?.[id]?.locked);
}
