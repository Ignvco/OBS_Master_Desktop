import type { EpisodeData, RundownBlock, ComponentType } from '../types/index.ts';

export const MANUAL_CHECKS = [
  { id: 'cameraImage', title: 'Imagen real de cámara revisada', detail: 'Comprobar encuadre, foco, iluminación y ausencia de imagen congelada.' },
  { id: 'introPlayback', title: 'Intro reproducida de principio a fin', detail: 'Confirmar el archivo real, imagen y duración de la intro.' },
  { id: 'macAudio', title: 'Audio de la Mac comprobado', detail: 'Micrófonos, música, niveles y ruta de entrada a StreamYard.' },
  { id: 'streamyard', title: 'StreamYard preparado', detail: 'Cámara virtual seleccionada, audio correcto e invitados revisados.' },
] as const;
export type ManualCheckId = typeof MANUAL_CHECKS[number]['id'];
export type ManualChecks = Partial<Record<ManualCheckId, boolean>>;
export interface PreparationState { startTime?: string; manualChecks?: ManualChecks; }

export function isTime(value: string): boolean {
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return false;
  const [h,m,s=0] = value.split(':').map(Number);
  return h < 24 && m < 60 && s < 60;
}
export function timeToSeconds(value: string): number {
  if (!isTime(value)) return 21 * 3600;
  const [h,m,s=0] = value.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
export function secondsToTime(seconds: number): string {
  const n = ((Math.round(seconds) % 86400) + 86400) % 86400;
  return [Math.floor(n/3600), Math.floor(n%3600/60), n%60].map(v=>String(v).padStart(2,'0')).join(':');
}
export function getStartTime(episode: EpisodeData): string {
  const v = episode.preparation?.startTime || episode.rundown[0]?.timePlanned || '21:00';
  return isTime(v) ? v.slice(0,5) : '21:00';
}
export function retimeRundown(blocks: RundownBlock[], startTime: string): RundownBlock[] {
  let clock = timeToSeconds(startTime);
  return blocks.map((block,i) => {
    const timePlanned = secondsToTime(clock);
    clock += Math.max(0, Number.isFinite(block.durationSeconds) ? block.durationSeconds : 0);
    return { ...block, order:i+1, timePlanned };
  });
}
export function updateRundown(episode: EpisodeData, blocks: RundownBlock[], startTime = getStartTime(episode)): EpisodeData {
  return { ...episode, rundown: retimeRundown(blocks,startTime), preparation: { ...episode.preparation, startTime } };
}
export function moveBlock(blocks: RundownBlock[], id: string, direction: -1|1): RundownBlock[] {
  const from = blocks.findIndex(b=>b.id===id); const to = from+direction;
  if(from<0 || to<0 || to>=blocks.length) return blocks;
  const next = [...blocks]; [next[from],next[to]]=[next[to],next[from]];
  return next;
}
export function validateRundown(blocks: RundownBlock[], scenes: string[], connected: boolean): string[] {
  const errors:string[]=[];
  if(blocks.length===0) errors.push('La escaleta no tiene bloques.');
  const seen = new Set<string>();
  for (const [i,block] of blocks.entries()) {
    if (!block.title.trim()) errors.push(`Bloque ${i+1}: falta título.`);
    if (!Number.isFinite(block.durationSeconds) || block.durationSeconds <= 0 || block.durationSeconds > 14400) errors.push(`Bloque ${i+1}: duración inválida.`);
    if(seen.has(block.id)) errors.push(`Bloque ${i+1}: identificador duplicado.`);
    seen.add(block.id);
    if (!block.obsSceneTarget.trim()) errors.push(`Bloque ${i+1}: falta escena de OBS.`);
    else if(connected && !scenes.includes(block.obsSceneTarget)) errors.push(`Bloque ${i+1}: escena «${block.obsSceneTarget}» no existe en OBS.`);
  }
  return errors;
}
export function missingGraphics(blocks: RundownBlock[], available: Partial<Record<ComponentType, unknown>>): ComponentType[] {
  return [...new Set(blocks.flatMap(b=>b.graphicComponents || []))].filter(type=>!available[type]);
}
export function markBlockStatus(blocks: RundownBlock[], id: string, status: RundownBlock['status']): RundownBlock[] {
  return blocks.map(b=> b.id===id ? {...b,status} : (status==='on-air' && b.status==='on-air' ? {...b,status:'completed' as const}:b));
}
