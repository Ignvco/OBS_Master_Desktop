/** View-only geometry for Content Studio. Does not change broadcast component coordinates. */
export const WORKSPACE_MIN_ZOOM = 50;
export const WORKSPACE_MAX_ZOOM = 250;
export type WorkspaceTool = 'select' | 'hand';
export interface WorkspacePreferences {
  zoom: number;
  grid: boolean;
  rulers: boolean;
  safeZones: boolean;
  snap: boolean;
  focus: boolean;
  background: 'dark' | 'camera' | 'transparent';
}
export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  zoom: 100, grid: false, rulers: true, safeZones: true, snap: true,
  focus: false, background: 'dark',
};
export function clampWorkspaceZoom(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(WORKSPACE_MAX_ZOOM, Math.max(WORKSPACE_MIN_ZOOM, Math.round(value)));
}
/** 100% means fitted to the available workspace, never native 1920px. */
export function fitCanvasWidth(width: number, height: number): number {
  const usableW = Math.max(240, width - 80);
  const usableH = Math.max(135, height - 80);
  return Math.min(960, usableW, usableH * 16 / 9);
}
export function worldPixelDelta(pointerDelta: number, fittedWidth: number, zoom: number): number {
  return pointerDelta * 1920 / Math.max(1, fittedWidth * clampWorkspaceZoom(zoom) / 100);
}
export function resolveWorkspacePreferences(input: unknown): WorkspacePreferences {
  if (!input || typeof input !== 'object') return {...DEFAULT_WORKSPACE_PREFERENCES};
  const value = input as Partial<WorkspacePreferences>;
  const flag = (key: keyof WorkspacePreferences, fallback: boolean) =>
    typeof value[key] === 'boolean' ? value[key] as boolean : fallback;
  return {
    zoom: clampWorkspaceZoom(value.zoom ?? 100),
    grid: flag('grid', false), rulers: flag('rulers', true),
    safeZones: flag('safeZones', true), snap: flag('snap', true), focus: flag('focus', false),
    background: ['dark','camera','transparent'].includes(value.background as string)
      ? value.background as WorkspacePreferences['background'] : 'dark',
  };
}
