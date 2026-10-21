import React, { useEffect, useRef, useState } from 'react';
import type { ComponentType, CountdownState, CustomComponentRegistry, EditorialComponentConfig } from '../../types';
import { SharedStation } from '../../services/sharedStation';
import { StorageService } from '../../services/storage';
import { INITIAL_COMPONENTS } from '../../constants/initialData';
import { selectDirectProgramGraphics,selectDirectPreviewGraphics } from '../../utils/directComposition';
import { GraphicComponentRenderer } from './GraphicComponentRenderers';
import { BrandLogoLayer } from './BrandLogoLayer';
import { useLayerTimeline } from '../../hooks/useLayerTimeline';
import { componentMotionProps, motionReplayKey } from '../../utils/animationEngine';
import { motion as Motion, AnimatePresence } from 'motion/react';

/**
 * One transparent 1920x1080 compositor page for the Unity Capture process.
 * This deliberately reuses Content Studio's exact graphic renderer and motion.
 * The Program feed uses ONLY published records; draft edits never leak on air.
 */
function DirectGraphic({ config, countdown }: {config: EditorialComponentConfig; countdown: CountdownState}) {
  const root = useRef<HTMLDivElement>(null);
  useLayerTimeline(root, config, config.animationReplay ?? 0, config.visibleInOBS);
  const {initial, animate, exit, transition} = componentMotionProps(config.animation);
  return (
    <Motion.div
      key={motionReplayKey(config.instanceId || config.id || config.type,config.animationReplay)}
      className="absolute"
      style={{left:`${config.geometry.x}px`,top:`${config.geometry.y}px`}}
      initial={initial} animate={animate} exit={exit} transition={transition}
    >
      <div style={{
        transform:`scale(${config.geometry.scale}) rotate(${config.geometry.rotation}deg)`,
        transformOrigin:'top left'
      }}>
        <div ref={root} className="relative" style={{width:config.geometry.width,height:config.geometry.height}}>
          <GraphicComponentRenderer config={config} countdown={countdown} />
          {!Array.isArray(config.layerOrder) && <BrandLogoLayer config={config}/>}
        </div>
      </div>
    </Motion.div>
  );
}
export function DirectCompositeRenderer({mode='program'}:{mode?:'program'|'preview'}) {
  const [components,setComponents]=useState<Record<ComponentType,EditorialComponentConfig>>(()=>StorageService.loadComponents());
  const [custom,setCustom]=useState<CustomComponentRegistry>(()=>StorageService.loadCustomComponents());
  const [countdown,setCountdown]=useState<CountdownState>(()=>StorageService.loadCountdown());
  const [,setClock]=useState(0);
  const [previewState,setPreviewState]=useState<{revision:number;ids:string[]}>({revision:0,ids:[]});
  const [directTakeId,setDirectTakeId]=useState('');

  useEffect(()=>{
    document.body.style.backgroundColor='transparent';
    document.documentElement.style.backgroundColor='transparent';
    let alive=true;
    void SharedStation.read().then(state=>{
      if(!alive||!state)return;
      if(state.components)setComponents(state.components);
      if(state.customComponents)setCustom(state.customComponents);
      if(state.countdown)setCountdown(state.countdown);
      if(typeof state.directTakeId==='string')setDirectTakeId(state.directTakeId);
      if(typeof state.directTakeId==='string')setDirectTakeId(state.directTakeId);
    }).catch(error=>console.warn('Direct compositor: station read failed',error));
    const unsubscribe=SharedStation.watch(state=>{
      if(!alive)return;
      if(state.components)setComponents(state.components);
      if(state.customComponents)setCustom(state.customComponents);
      if(state.countdown)setCountdown(state.countdown);
    },()=>console.warn('Direct compositor: station events disconnected'));
    const timer=window.setInterval(()=>setClock(n=>n+1),250);
    return ()=>{
      alive=false;unsubscribe();window.clearInterval(timer);
      document.body.style.backgroundColor='';
      document.documentElement.style.backgroundColor='';
    };
  },[]);

  useEffect(()=>{
    if(mode!=='preview')return;
    let active=true;
    const poll=async()=>{
      try{
        const response=await fetch('/api/direct/preview',{cache:'no-store'});
        if(!response.ok) return;
        const payload=await response.json();
        if(active && Array.isArray(payload.preview?.ids) && Number.isSafeInteger(payload.preview?.revision))
          setPreviewState({revision:payload.preview.revision,ids:payload.preview.ids});
      }catch{/* hold last valid Preview until station recovers */}
    };
    void poll();
    const id=window.setInterval(()=>void poll(),800);
    return ()=>{active=false;window.clearInterval(id);};
  },[mode]);

  const remaining=countdown.isRunning&&!countdown.isPaused&&countdown.deadlineMs
    ? Math.max(0,Math.ceil((countdown.deadlineMs-Date.now())/1000))
    : countdown.remainingSeconds;
  const effectiveCountdown={...countdown,remainingSeconds:remaining};
  // Deterministic stacking: built-in catalogue order, then custom graphics.
  // Per-scene order is an upcoming Production Controller responsibility.
  const graphics=(mode==='preview'
    ? selectDirectPreviewGraphics(components,custom,previewState.ids)
    : selectDirectProgramGraphics(components,custom)
  ).map(config=>config.type==='logo-bug'&&!config.branding
    ? {...config,branding:INITIAL_COMPONENTS['logo-bug'].branding}
    : config);
  return <div
    data-direct-preview-revision={mode==='preview'?String(previewState.revision):undefined}
    data-direct-take-id={mode==='program'?directTakeId:undefined}
    className="fixed inset-0 w-[1920px] h-[1080px] pointer-events-none select-none bg-transparent overflow-hidden">
    <AnimatePresence>
      {graphics.map(config=>
        <DirectGraphic key={motionReplayKey(config.instanceId||config.id||config.type,config.animationReplay)}
          config={config} countdown={effectiveCountdown} />
      )}
    </AnimatePresence>
  </div>;
}
