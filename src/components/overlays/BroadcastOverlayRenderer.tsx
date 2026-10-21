import React, { useEffect, useState, useRef } from 'react';
import { ComponentType, EditorialComponentConfig, CountdownState, CustomComponentRegistry } from '../../types';
import { StorageService } from '../../services/storage';
import { GraphicComponentRenderer } from './GraphicComponentRenderers';
import { BrandLogoLayer } from './BrandLogoLayer';
import { INITIAL_COMPONENTS } from '../../constants/initialData';
import { componentMotionProps, motionReplayKey } from '../../utils/animationEngine';
import { SharedStation } from '../../services/sharedStation';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { useLayerTimeline } from '../../hooks/useLayerTimeline';

interface BroadcastOverlayRendererProps {
  overlayType: ComponentType;
  instanceId?: string;
}

export const BroadcastOverlayRenderer: React.FC<BroadcastOverlayRendererProps> = ({ overlayType, instanceId }) => {
  const [components, setComponents] = useState<Record<ComponentType, EditorialComponentConfig>>(() =>
    StorageService.loadComponents()
  );
  const [customComponents, setCustomComponents] = useState<CustomComponentRegistry>(()=>StorageService.loadCustomComponents());
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    StorageService.loadCountdown()
  );

  // Ensure body is transparent for OBS Browser Source
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, []);

  // The OBS browser is a separate browser storage partition. State arrives from
  // our local server; the localStorage fallback is used only when offline.
  useEffect(() => {
    let alive = true;
    void SharedStation.read().then(state => {
      if (!alive || !state) return;
      if (state.components) setComponents(state.components);
      if (state.customComponents) setCustomComponents(state.customComponents);
      if (state.countdown) setCountdown(state.countdown);
    }).catch(() => console.warn('OBS overlay: servidor de sincronización no disponible'));
    const stop = SharedStation.watch(state => {
      if (!alive) return;
      if (state.components) setComponents(state.components);
      if (state.customComponents) setCustomComponents(state.customComponents);
      if (state.countdown) setCountdown(state.countdown);
    });
    return () => { alive = false; stop(); };
  }, []);

  // Deadline-based countdown continues in sync across the control panel and OBS.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(n => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);
  const timeRemaining = countdown.isRunning && !countdown.isPaused && countdown.deadlineMs
    ? Math.max(0, Math.ceil((countdown.deadlineMs - Date.now()) / 1000))
    : countdown.remainingSeconds;
  const effectiveCountdown = { ...countdown, remainingSeconds: timeRemaining };

  const rawConfig = instanceId ? customComponents[instanceId] : components[overlayType];
  const config = rawConfig && overlayType === 'logo-bug' && !rawConfig.branding
    ? { ...rawConfig, branding: INITIAL_COMPONENTS['logo-bug'].branding }
    : rawConfig;
  // Avoid a conditional hook call if the initial persisted record is incomplete.
  const stableConfig = config ?? INITIAL_COMPONENTS[overlayType];

  const graphicRoot = useRef<HTMLDivElement>(null);
  useLayerTimeline(graphicRoot,stableConfig,stableConfig.animationReplay ?? 0,stableConfig.visibleInOBS);
  const { initial: enter, animate, exit, transition } = componentMotionProps(stableConfig.animation);

  if (instanceId && !rawConfig) return null;

  return (
    <div className="fixed inset-0 w-[1920px] h-[1080px] overflow-hidden pointer-events-none bg-transparent select-none">
      <AnimatePresence>
        {stableConfig.visibleInOBS && (
          <Motion.div key={motionReplayKey(stableConfig.id || stableConfig.type,stableConfig.animationReplay)} className="absolute" style={{
            left: `${stableConfig.geometry.x}px`,
            top: `${stableConfig.geometry.y}px`,
          }}
              initial={enter}
              animate={animate}
              exit={exit}
              transition={transition}
          >
            <div style={{
              transform: `scale(${stableConfig.geometry.scale}) rotate(${stableConfig.geometry.rotation}deg)`,
              transformOrigin: 'top left',
            }}>
              <div ref={graphicRoot} className="relative" style={{ width: stableConfig.geometry.width, height: stableConfig.geometry.height }}>
                <GraphicComponentRenderer config={stableConfig} countdown={effectiveCountdown} />
                {!Array.isArray(stableConfig.layerOrder) && <BrandLogoLayer config={stableConfig}/>}
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
