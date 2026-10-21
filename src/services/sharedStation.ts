import type { EpisodeData, EditorialComponentConfig, ComponentType, CountdownState, CustomComponentRegistry } from '../types';
import type {PublicationHistory,PublicationTimeline} from '../utils/publicationEngine';

export interface SharedStationState {
  episode?: EpisodeData;
  components?: Record<ComponentType, EditorialComponentConfig>;
  customComponents?: CustomComponentRegistry;
  draftComponents?: Record<ComponentType, EditorialComponentConfig>;
  draftCustomComponents?: CustomComponentRegistry;
  publicationHistory?: PublicationHistory;
  countdown?: CountdownState;
}

/**
 * Single local origin is served on 127.0.0.1:3000; OBS Browser Sources receive updates
 * from the same server, not from isolated localStorage partitions.
 */
export class SharedStation {
  /** Serialize writes: a slow old PATCH must never overwrite a newer edit. */
  private static writeQueue: Promise<unknown> = Promise.resolve();
  static async read(): Promise<SharedStationState | null> {
    const response = await fetch('/api/station/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Servicio compartido no disponible');
    const payload = await response.json();
    return payload.state ?? null;
  }

  static publish(patch: SharedStationState): Promise<void> {
    const operation = this.writeQueue.then(async () => {
    const response = await fetch('/api/station/state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(typeof error.error === 'string' ? error.error : `No fue posible sincronizar las gráficas (${response.status})`);
    }
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  static async publicationHistory(): Promise<PublicationHistory> {
    const response = await fetch('/api/station/publications', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo consultar el historial de publicaciones');
    return (await response.json()).history ?? {};
  }

  private static mutation(action: string,id:string,version?:number,label?:string):Promise<{history:PublicationTimeline|null;published?:EditorialComponentConfig;draft?:EditorialComponentConfig}>{
    const operation=this.writeQueue.then(async()=>{
      const response=await fetch('/api/station/publications',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,id,version,label,confirm:action==='publish'?'PUBLICAR':action==='remove'?'ELIMINAR':undefined})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'No se pudo actualizar el historial');
      return payload;
    });
    this.writeQueue=operation.catch(()=>undefined);
    return operation;
  }
  static publishGraphic(id:string){return this.mutation('publish',id);}
  static manageGraphicRevision(id:string,action:'save'|'restore-draft'|'rename'|'remove'|'pin',version?:number,label?:string){
    return this.mutation(action,id,version,label);
  }

  static watch(onUpdate: (state: SharedStationState) => void, onError?: () => void): () => void {
    const stream = new EventSource('/api/station/events');
    stream.addEventListener('update', (event) => {
      try { onUpdate(JSON.parse((event as MessageEvent).data)); } catch { /* invalid event */ }
    });
    stream.onerror = () => onError?.();
    return () => stream.close();
  }
}
