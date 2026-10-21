import {useEffect} from 'react';
import type {RefObject} from 'react';
import type {EditorialComponentConfig} from '../types';
import {playLayerTimelines} from '../utils/layerTimeline';
/** Re-run only when timeline parameters change, not when the text is typed. */
export function useLayerTimeline(root:RefObject<HTMLElement|null>, config:EditorialComponentConfig, replayId:number, enabled=true) {
  const signature=JSON.stringify({overrides:Object.entries(config.layerOverrides??{}).map(([id,value])=>[id,value.motion]),layers:config.layers?.map(layer=>[layer.id,layer.motion]), stagger:config.animation.staggerWords||config.animation.preset==='stagger-fade-up'});
  useEffect(()=>{
    if(!enabled||!root.current) return;
    const motions:Record<string,any>={};
    for(const [id,value] of Object.entries(config.layerOverrides??{})) if(value.motion) motions[id]=value.motion;
    for(const layer of config.layers??[]) if(layer.motion) motions[layer.id]=layer.motion;
    const stopLayers=playLayerTimelines(root.current,motions);
    const staggerAnimations:Animation[]=[];
    if(config.animation.staggerWords || config.animation.preset==='stagger-fade-up') {
      const ids=['kicker','headline','subtitle','badge'];
      const elements=ids.flatMap(id=>Array.from(root.current!.querySelectorAll<HTMLElement>(`[data-stdq-layer=\"${id}\"]`)));
      elements.filter(element=>!motions[element.dataset.stdqLayer||'']).forEach((element,index)=>{
        const animation=element.animate(
          [{opacity:0,translate:'0px 16px'}, {opacity:1,translate:'0px 0px'}],
          {duration:Math.max(150,Math.min(2000,config.animation.entryDurationMs)),delay:config.animation.delayMs+index*100,fill:'both',easing:'cubic-bezier(0.16, 1, 0.3, 1)'}
        );
        staggerAnimations.push(animation);
      });
    }
    return ()=>{stopLayers();staggerAnimations.forEach(a=>a.cancel());};
  },[signature,replayId,config.type,enabled]);
}
