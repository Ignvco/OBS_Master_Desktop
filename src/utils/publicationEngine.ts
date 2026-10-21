/** Editorial versioning: publishing and draft restoration NEVER create historical versions.
 * Versions are intentional snapshots managed separately from live broadcast state.
 */
import type { ComponentType, CustomComponentRegistry, EditorialComponentConfig } from '../types/index.ts';
import { CUSTOM_ID_PATTERN } from './componentRegistry.ts';

export const PUBLICATION_HISTORY_LIMIT = 20;
export interface PublicationRevision {
  version: number;
  publishedAt: string; // Legacy storage key; now represents snapshot creation time.
  config: EditorialComponentConfig;
  action: 'publish' | 'restore' | 'baseline' | 'snapshot';
  label?: string;
  pinned?: boolean;
}
export interface PublicationTimeline {
  currentVersion: number; // Monotonic snapshot identifier, not broadcast publication count.
  revisions: PublicationRevision[];
}
export type PublicationHistory = Record<string, PublicationTimeline>;
export type PublicationDocument = {
  components?: Record<ComponentType, EditorialComponentConfig>;
  customComponents?: CustomComponentRegistry;
  draftComponents?: Record<ComponentType, EditorialComponentConfig>;
  draftCustomComponents?: CustomComponentRegistry;
  publicationHistory?: PublicationHistory;
};
export const isCustomGraphicId = (id: string): boolean => CUSTOM_ID_PATTERN.test(id);
export function graphicFromDocument(state: PublicationDocument, id: string, draft: boolean): EditorialComponentConfig | undefined {
  if (isCustomGraphicId(id)) return (draft ? state.draftCustomComponents : state.customComponents)?.[id];
  return (draft ? state.draftComponents : state.components)?.[id as ComponentType];
}
function validateIdentity(config:EditorialComponentConfig,id:string):void {
  if (isCustomGraphicId(id) ? config.instanceId !== id : config.type !== id) throw new Error('La revisión no corresponde a esta gráfica');
}
/** Publication is an operational decision. It never produces a revision. */
export function applyPublication(state: PublicationDocument, id: string, now = new Date().toISOString()): PublicationDocument {
  const current = graphicFromDocument(state, id, false);
  if (current?.visibleInOBS) throw new Error('Retira la gráfica del aire antes de publicar.');
  const draft = graphicFromDocument(state, id, true);
  if (!draft) throw new Error('No hay un borrador guardado de esta gráfica');
  validateIdentity(draft,id);
  const published:EditorialComponentConfig={...structuredClone(draft),visibleInOBS:current?.visibleInOBS??false,
    animationReplay:current?.animationReplay??0,obsSourceLinks:current?.obsSourceLinks??draft.obsSourceLinks,updatedAt:now};
  if (isCustomGraphicId(id))return {...state,customComponents:{...(state.customComponents??{}),[id]:published}};
  return {...state,components:{...state.components,[id]:published} as Record<ComponentType,EditorialComponentConfig>};
}
/** Create a snapshot ONLY when the operator asks for one. */
export function saveRevision(state:PublicationDocument,id:string,label:string,now=new Date().toISOString()):PublicationDocument {
  const config=graphicFromDocument(state,id,true);
  if(!config)throw new Error('No existe borrador para guardar');
  validateIdentity(config,id);
  if(typeof label!=='string'||label.trim().length>64)throw new Error('Nombre demasiado largo');
  const previous=state.publicationHistory?.[id];
  const revisions=[...(previous?.revisions??[])];
  const nextVersion=Math.max(previous?.currentVersion??0,...revisions.map(r=>r.version),0)+1;
  const saved:PublicationRevision={version:nextVersion,publishedAt:now,action:'snapshot',label:label.trim()||`Versión ${nextVersion}`,
    config:structuredClone({...config,visibleInOBS:false,animationReplay:0})};
  if(revisions.length>=PUBLICATION_HISTORY_LIMIT){
    const oldest= revisions.findIndex(r=>!r.pinned);
    if(oldest===-1)throw new Error('Historial lleno de versiones protegidas. Desprotege una para guardar.');
    revisions.splice(oldest,1);
  }
  revisions.push(saved);
  return {...state,publicationHistory:{...state.publicationHistory,[id]:{currentVersion:nextVersion,revisions}}};
}
/** Restore into draft ONLY: the published design and OBS source stay untouched. */
export function restoreRevisionToDraft(state:PublicationDocument,id:string,version:number):PublicationDocument {
  const stored=state.publicationHistory?.[id]?.revisions.find(r=>r.version===version);
  if(!stored)throw new Error('Versión solicitada no disponible');
  validateIdentity(stored.config,id);
  const previous=graphicFromDocument(state,id,true);
  const recovered:EditorialComponentConfig={...structuredClone(stored.config),visibleInOBS:false,animationReplay:0,
    obsSourceLinks:previous?.obsSourceLinks??stored.config.obsSourceLinks,updatedAt:new Date().toISOString()};
  if(isCustomGraphicId(id))return {...state,draftCustomComponents:{...(state.draftCustomComponents??{}),[id]:recovered}};
  return {...state,draftComponents:{...state.draftComponents,[id]:recovered} as Record<ComponentType,EditorialComponentConfig>};
}
export function manageRevision(state:PublicationDocument,id:string,version:number,action:'rename'|'remove'|'pin',label?:string):PublicationDocument {
  const timeline=state.publicationHistory?.[id];
  if(!timeline)throw new Error('No existe historial para esta gráfica');
  const index=timeline.revisions.findIndex(r=>r.version===version);
  if(index<0)throw new Error('Versión solicitada no disponible');
  const revisions=timeline.revisions.map(r=>({...r}));
  if(action==='rename'){
    if(typeof label!=='string'||!label.trim()||label.trim().length>64)throw new Error('El nombre debe contener entre 1 y 64 caracteres');
    revisions[index].label=label.trim();
  }else if(action==='pin')revisions[index].pinned=!revisions[index].pinned;
  else {
    if(revisions[index].pinned)throw new Error('Primero desprotege esta versión antes de eliminarla');
    revisions.splice(index,1);
  }
  return {...state,publicationHistory:{...state.publicationHistory,[id]:{...timeline,revisions}}};
}

/** Operators may change ONLY visibility, replay, and OBS links on published records. */
export function operationalOnlyPatch(current: Record<string, EditorialComponentConfig> | undefined, update: Record<string, EditorialComponentConfig>): boolean {
  if (!current || Object.keys(current).length !== Object.keys(update).length) return false;
  return Object.entries(update).every(([id, value]) => {
    const old = current[id];
    if (!old) return false;
    const clean = (c: EditorialComponentConfig) => {
      const copy: Partial<EditorialComponentConfig> = { ...c };
      delete copy.visibleInOBS; delete copy.animationReplay; delete copy.obsSourceLinks; delete copy.updatedAt;
      return JSON.stringify(copy);
    };
    return clean(old) === clean(value);
  });
}
