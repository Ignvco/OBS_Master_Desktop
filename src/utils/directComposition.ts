import type {ComponentType,CustomComponentRegistry,EditorialComponentConfig} from '../types/index.ts';
import {INITIAL_COMPONENTS} from '../constants/initialData.ts';

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
    .filter((config):config is EditorialComponentConfig=>Boolean(config&&config.visibleInOBS))
    .map(config=>config.type==='logo-bug'&&!config.branding
      ? {...config,branding:INITIAL_COMPONENTS['logo-bug'].branding}
      : config);
}
