import type { ComponentType, CustomComponentRegistry, EditorialComponentConfig } from '../types/index.ts';

export type OutputMode = 'obs' | 'direct';
export type DirectGraphicsState = {
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents: CustomComponentRegistry;
};

export function parseOutputMode(value: string | null): OutputMode {
  return value === 'direct' ? 'direct' : 'obs';
}

/**
 * Uses the existing published operational fields for compatibility with the
 * OBS MASTER v4.2 renderer and station SSE. No design/history is changed.
 *
 * This acknowledges state persisted by the local station, NOT frames observed
 * in Unity Capture or StreamYard. The operator must verify the video output.
 */
export function directVisibilityPatch(
  state: DirectGraphicsState,
  id: string,
  visible: boolean,
  now = new Date().toISOString(),
): Partial<DirectGraphicsState> {
  const custom = state.customComponents[id];
  if (custom) {
    return {
      customComponents: {
        ...state.customComponents,
        [id]: { ...custom, visibleInOBS: visible, updatedAt: now },
      },
    };
  }
  const builtIn = state.components[id as ComponentType];
  if (!builtIn) throw new Error('Gráfica publicada no disponible');
  return {
    components: {
      ...state.components,
      [id]: { ...builtIn, visibleInOBS: visible, updatedAt: now },
    },
  };
}

export function directReplayPatch(
  state: DirectGraphicsState,
  id: string,
): Partial<DirectGraphicsState> {
  const custom = state.customComponents[id];
  const builtIn = state.components[id as ComponentType];
  const graphic = custom ?? builtIn;
  if (!graphic) throw new Error('Gráfica publicada no disponible');
  if (!graphic.visibleInOBS) throw new Error('Primero muestra la gráfica en Direct');
  const next = { ...graphic, animationReplay: (graphic.animationReplay ?? 0) + 1 };
  return custom
    ? { customComponents: { ...state.customComponents, [id]: next } }
    : { components: { ...state.components, [id]: next } };
}

export function directHideAllPatch(
  state: DirectGraphicsState,
  now = new Date().toISOString(),
): DirectGraphicsState {
  return {
    components: Object.fromEntries(
      Object.entries(state.components).map(([id, config]) =>
        [id, { ...config, visibleInOBS: false, updatedAt: now }],
      ),
    ) as DirectGraphicsState['components'],
    customComponents: Object.fromEntries(
      Object.entries(state.customComponents).map(([id, config]) =>
        [id, { ...config, visibleInOBS: false, updatedAt: now }],
      ),
    ),
  };
}
