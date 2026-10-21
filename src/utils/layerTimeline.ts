/** Per-layer animation schema and keyframe generator shared by editor and OBS Browser Source. */
export type LayerEffect = 'none'|'fade'|'rise'|'slide-left'|'slide-right'|'scale'|'pop';
export interface LayerMotion {
  effect: LayerEffect;
  delayMs: number;
  entryMs: number;
  holdMs: number; // 0 = remain visible until OBS hides the component
  exitMs: number;
  easing: 'ease-out'|'ease-in-out'|'linear'|'cubic-bezier(0.16, 1, 0.3, 1)';
}
export const DEFAULT_LAYER_MOTION:LayerMotion={effect:'none',delayMs:0,entryMs:550,holdMs:0,exitMs:350,easing:'cubic-bezier(0.16, 1, 0.3, 1)'};
export function normalizeLayerMotion(input?: Partial<LayerMotion>): LayerMotion {
  const m={...DEFAULT_LAYER_MOTION,...input};
  const clamp=(v:number,limit:number)=>Number.isFinite(v)?Math.max(0,Math.min(limit,v)):0;
  return {...m,delayMs:clamp(m.delayMs,120000),entryMs:Math.max(1,clamp(m.entryMs,30000)),holdMs:clamp(m.holdMs,600000),exitMs:Math.max(1,clamp(m.exitMs,30000))};
}
export function layerMotionFrames(motion: LayerMotion, baseOpacity=1) {
  const m=normalizeLayerMotion(motion);
  if(m.effect==='none') return null;
  const hasExit=m.holdMs>0;
  const duration=m.entryMs+(hasExit?m.holdMs+m.exitMs:0);
  const entryEnd=m.entryMs/duration;
  const holdEnd=hasExit?(m.entryMs+m.holdMs)/duration:1;
  const offset:Record<LayerEffect,{translate:string;scale:number}>={
    'none':{translate:'0px 0px',scale:1},'fade':{translate:'0px 0px',scale:1},
    'rise':{translate:'0px 34px',scale:1},'slide-left':{translate:'-85px 0px',scale:1},
    'slide-right':{translate:'85px 0px',scale:1},'scale':{translate:'0px 0px',scale:.78},
    'pop':{translate:'0px 0px',scale:.65},
  };
  const from=offset[m.effect];
  // CSS individual translate/scale properties preserve the element's independent rotate setting.
  const frames:Keyframe[]=[
    {offset:0,opacity:0,translate:from.translate,scale:from.scale,easing:m.easing},
    {offset:entryEnd,opacity:baseOpacity,translate:'0px 0px',scale:1},
  ];
  if(hasExit) {
    frames.push({offset:holdEnd,opacity:baseOpacity,translate:'0px 0px',scale:1,easing:'ease-in-out'});
    frames.push({offset:1,opacity:0,translate:'0px -15px',scale:.96});
  }
  return {frames,duration,delay:m.delayMs};
}
/** Animates only the elements having explicit motion. No global reflow of the template. */
export function playLayerTimelines(root:HTMLElement, motionById:Record<string,Partial<LayerMotion>>):()=>void {
  const animations:Animation[]=[];
  for(const element of Array.from(root.querySelectorAll<HTMLElement>('[data-stdq-layer]'))) {
    const id=element.getAttribute('data-stdq-layer');
    if(!id) continue;
    const motion=motionById[id];
    if(!motion) continue;
    const opacity=Number.parseFloat(getComputedStyle(element).opacity||'1');
    const keyframeData=layerMotionFrames(normalizeLayerMotion(motion),Number.isFinite(opacity)?opacity:1);
    if(!keyframeData) continue;
    const existing=getComputedStyle(element).translate;
    const parts=(existing && existing!=='none') ? existing.split(' ') : ['0px','0px'];
    const x=parts[0]||'0px', y=parts[1]||'0px';
    const frames=keyframeData.frames.map(frame=> {
      const offset=String(frame.translate||'0px 0px').split(' ');
      return {...frame,translate:`calc(${x} + ${offset[0]||'0px'}) calc(${y} + ${offset[1]||'0px'})`};
    });
    const a=element.animate(frames,{duration:keyframeData.duration,delay:keyframeData.delay,fill:'both'});
    animations.push(a);
  }
  return ()=>{for(const a of animations)a.cancel();};
}
