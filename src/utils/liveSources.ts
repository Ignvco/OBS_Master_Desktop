import type { ComponentType, EditorialComponentConfig, OBSSceneSource } from '../types';
import { SOURCE_ALIASES } from '../constants/obsSources.ts';
import { matchesCustomOverlayUrl } from './componentRegistry.ts';

function matchesTemplateOverlayUrl(raw:string,type:ComponentType):boolean {
  try {
    const url=new URL(raw);
    return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)
      &&url.pathname==='/'&&url.searchParams.get('overlay')===type;
  }catch{return false;}
}
/** Only exact, verified URLs can auto-associate a custom graphic; never by its visible label. */
export function matchingLiveSources(sources:OBSSceneSource[],component:Pick<EditorialComponentConfig,'name'|'instanceId'>,type:ComponentType,manualSource?:string):OBSSceneSource[]{
  const names=[component.name,...(SOURCE_ALIASES[type]||[])].map(name=>name.trim().toLocaleLowerCase());
  return sources.filter(source=>{
    if(source.type!=='browser_source')return false;
    const selected=manualSource ? source.name===manualSource : false;
    if(component.instanceId){
      if(source.browserUrl)return matchesCustomOverlayUrl(source.browserUrl,component.instanceId)&&(manualSource?selected:true);
      // Unverified custom URLs NEVER automatically bind, not even by label/alias.
      return selected;
    }
    if(source.browserUrl){
      return matchesTemplateOverlayUrl(source.browserUrl,type)&&(manualSource?selected:true);
    }
    return manualSource?selected:names.includes(source.name.trim().toLocaleLowerCase());
  });
}
export function listBindableSources(sources:OBSSceneSource[]):OBSSceneSource[]{
  // Unknown kinds may be listed, but cannot be operated until OBS confirms browser_source.
  return sources.filter(source=>source.type==='browser_source');
}
/** Summary of verified OBS bindings, used by Live UI without changing broadcast state. */
export function liveBindingReport(sources:OBSSceneSource[],graphics:EditorialComponentConfig[],sourceLink?:(graphic:EditorialComponentConfig)=>string):{verified:number;missing:number;ambiguous:number;live:number}{
  return graphics.reduce((report,graphic)=>{
    const matches=matchingLiveSources(sources,graphic,graphic.type,sourceLink?.(graphic));
    if(matches.length===1){report.verified++;if(matches[0].enabled)report.live++;}
    else if(matches.length>1)report.ambiguous++;
    else report.missing++;
    return report;
  },{verified:0,missing:0,ambiguous:0,live:0});
}
