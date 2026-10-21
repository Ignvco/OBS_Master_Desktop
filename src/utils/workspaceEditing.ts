import type { EditorialComponentConfig, GraphicLayer, LayerOverride } from '../types/index.ts';
import {editableTemplateLayersFor} from './graphicLayers.ts';

/** Selection and layout are editor operations; updates retain the existing OBS renderer/data format. */
export type LayerRect = { x:number; y:number; width:number; height:number };
export type LayerRects = Record<string,LayerRect>;
export type SelectionModifier = 'replace'|'toggle';
export type AlignAction = 'left'|'center-x'|'right'|'top'|'center-y'|'bottom';
export type DistributionAxis = 'x'|'y';
export function layerIds(config: EditorialComponentConfig): string[] {
  return [...editableTemplateLayersFor(config).map(layer=>layer.id),...(config.layers??[]).map(layer=>layer.id)];
}
export function layerGroup(config:EditorialComponentConfig,id:string):string|undefined {
  return config.layers?.find(layer=>layer.id===id)?.groupId ?? config.layerOverrides?.[id]?.groupId;
}
export function membersOfGroup(config:EditorialComponentConfig,id:string):string[] {
  const group=layerGroup(config,id);
  return group ? layerIds(config).filter(candidate=>layerGroup(config,candidate)===group) : [id];
}
export function selectLayer(config:EditorialComponentConfig,selection:string[],id:string,modifier:SelectionModifier):string[] {
  if (!layerIds(config).includes(id)) return selection;
  const target=membersOfGroup(config,id);
  if (modifier==='replace') return target;
  const allSelected=target.every(item=>selection.includes(item));
  return allSelected ? selection.filter(item=>!target.includes(item)) : [...new Set([...selection,...target])];
}
export function isLocked(config:EditorialComponentConfig,id:string):boolean {
  return Boolean(config.layers?.find(x=>x.id===id)?.locked ?? config.layerOverrides?.[id]?.locked);
}
export function moveSelection(config:EditorialComponentConfig,ids:string[],dx:number,dy:number):Partial<EditorialComponentConfig> {
  const target=new Set(ids.filter(id=>!isLocked(config,id)));
  if(!target.size)return {};
  const overrides={...config.layerOverrides};
  for(const original of editableTemplateLayersFor(config)) {
    if(!target.has(original.id))continue;
    const current=overrides[original.id]??{};
    overrides[original.id]={...current,x:Math.round((current.x??0)+dx),y:Math.round((current.y??0)+dy)};
  }
  return {
    layerOverrides:overrides,
    layers:(config.layers??[]).map(layer=>target.has(layer.id)?{...layer,x:Math.round(layer.x+dx),y:Math.round(layer.y+dy)}:layer),
  };
}
export function assignGroup(config:EditorialComponentConfig,ids:string[],groupId:string|undefined):Partial<EditorialComponentConfig> {
  const target=new Set(ids);
  const overrides={...config.layerOverrides};
  for(const original of editableTemplateLayersFor(config)){
    if(!target.has(original.id))continue;
    overrides[original.id]={...overrides[original.id],groupId};
  }
  return {layerOverrides:overrides,layers:(config.layers??[]).map(layer=>target.has(layer.id)?{...layer,groupId}:layer)};
}
export function alignSelection(config:EditorialComponentConfig,ids:string[],rects:LayerRects,action:AlignAction):Partial<EditorialComponentConfig> {
  const selected=ids.filter(id=>!isLocked(config,id)&&rects[id]);
  if(selected.length<2)return {};
  const union=selected.reduce((box,id)=>{
    const r=rects[id];return {left:Math.min(box.left,r.x),right:Math.max(box.right,r.x+r.width),top:Math.min(box.top,r.y),bottom:Math.max(box.bottom,r.y+r.height)};
  },{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
  const xAxis=action==='left'||action==='right'||action==='center-x';
  const target=action==='left'?union.left:action==='right'?union.right:action==='center-x'?(union.left+union.right)/2:
    action==='top'?union.top:action==='bottom'?union.bottom:(union.top+union.bottom)/2;
  const adjustments=selected.map(id=>{
    const rect=rects[id];
    const edge=action==='left'?rect.x:action==='right'?rect.x+rect.width:action==='center-x'?rect.x+rect.width/2:
      action==='top'?rect.y:action==='bottom'?rect.y+rect.height:rect.y+rect.height/2;
    return {id,dx:xAxis?target-edge:0,dy:xAxis?0:target-edge};
  });
  return translateIndividual(config,adjustments);
}
export function distributeSelection(config:EditorialComponentConfig,ids:string[],rects:LayerRects,axis:DistributionAxis):Partial<EditorialComponentConfig> {
  const selected=ids.filter(id=>!isLocked(config,id)&&rects[id]);
  if(selected.length<3)return {};
  const ordered=[...selected].sort((a,b)=>axis==='x'?rects[a].x-rects[b].x:rects[a].y-rects[b].y);
  const size=(id:string)=>axis==='x'?rects[id].width:rects[id].height;
  const start=(id:string)=>axis==='x'?rects[id].x:rects[id].y;
  const first=start(ordered[0]);
  const last=start(ordered[ordered.length-1])+size(ordered[ordered.length-1]);
  const occupied=ordered.reduce((sum,id)=>sum+size(id),0);
  const gap=(last-first-occupied)/(ordered.length-1);
  let cursor=first;
  const shifts=ordered.map((id,index)=>{
    const delta=index===0||index===ordered.length-1?0:cursor-start(id);
    const shift={id,dx:axis==='x'?delta:0,dy:axis==='y'?delta:0};
    cursor+=size(id)+gap;return shift;
  });
  return translateIndividual(config,shifts);
}
export function translateIndividual(config:EditorialComponentConfig,movements:{id:string;dx:number;dy:number}[]):Partial<EditorialComponentConfig> {
  const shifts=new Map(movements.map(m=>[m.id,m]));
  const overrides={...config.layerOverrides};
  for(const original of editableTemplateLayersFor(config)){
    const m=shifts.get(original.id);if(!m||isLocked(config,original.id))continue;
    const old=overrides[original.id]??{};
    overrides[original.id]={...old,x:Math.round((old.x??0)+m.dx),y:Math.round((old.y??0)+m.dy)};
  }
  return {layerOverrides:overrides,layers:(config.layers??[]).map(layer=>{
    const m=shifts.get(layer.id);return !m||layer.locked?layer:{...layer,x:Math.round(layer.x+m.dx),y:Math.round(layer.y+m.dy)};
  })};
}
export function duplicateCustomSelection(config:EditorialComponentConfig,ids:string[],makeId:()=>string):{patch:Partial<EditorialComponentConfig>;ids:string[]} {
  const selected=new Set(ids);
  const source=(config.layers??[]).filter(layer=>selected.has(layer.id)&&!layer.locked);
  const groups=new Map<string,string>();
  const copies:GraphicLayer[]=source.map(layer=>{
    let groupId: string|undefined;
    if(layer.groupId){if(!groups.has(layer.groupId))groups.set(layer.groupId,makeId());groupId=groups.get(layer.groupId);}
    return {...layer,id:makeId(),groupId,name:`${layer.name} (copia)`,x:layer.x+20,y:layer.y+20,zIndex:(config.layers?.length??0)+10+source.indexOf(layer)};
  });
  return {patch:{layers:[...(config.layers??[]),...copies]},ids:copies.map(x=>x.id)};
}
