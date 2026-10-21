import type {ComponentType,CustomComponentRegistry,EditorialComponentConfig} from '../types/index.ts';

/**
 * Select ONLY published, explicitly visible graphics. No draft input is accepted.
 * Keeps catalogue-first / custom-second stable paint order until scene-order
 * control is backed by the native engine.
 */
export function selectDirectProgramGraphics(
  components:Record<ComponentType,EditorialComponentConfig>,
  customComponents:CustomComponentRegistry,
):EditorialComponentConfig[]{
  return [...Object.values(components),...Object.values(customComponents)]
    .filter((config):config is EditorialComponentConfig=>Boolean(config&&config.visibleInOBS));
}

/** Preview is staged independently. A hidden-but-published graphic may be rehearsed. */
export function selectDirectPreviewGraphics(
  components:Record<ComponentType,EditorialComponentConfig>,
  customComponents:CustomComponentRegistry,
  ids:readonly string[],
):EditorialComponentConfig[]{
  const lookup:Record<string,EditorialComponentConfig>={...components,...customComponents};
  return ids.filter(id=>Object.prototype.hasOwnProperty.call(lookup,id))
    .map(id=>({...lookup[id],visibleInOBS:true}));
}
