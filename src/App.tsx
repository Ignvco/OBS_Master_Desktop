import React, { useState, useEffect, useRef } from 'react';
import { 
  NavigationSpace, 
  EpisodeData, 
  EditorialComponentConfig, 
  ComponentType, 
  CountdownState, 
  OBSStatus,
  OBSConnectionConfig,
  BroadcastStateSnapshot,
  CustomComponentRegistry
} from './types';
import { StorageService } from './services/storage';
import type {PublicationHistory} from './utils/publicationEngine';
import { SharedStation } from './services/sharedStation';
import { LibraryService } from './services/libraryService';
import { obsService } from './services/obsWebSocket';
import { Header } from './components/common/Header';
import { ConnectionModal } from './components/common/ConnectionModal';
import { NotificationToast, ToastMessage } from './components/common/NotificationToast';
import { MissionControlSpace } from './components/spaces/MissionControlSpace';
import { PreflightRundownSpace } from './components/spaces/PreflightRundownSpace';
import { BroadcastControlSpace } from './components/spaces/BroadcastControlSpace';
import { ContentStudioSpace } from './components/spaces/ContentStudioSpace';
import { AssetLibrarySpace } from './components/spaces/AssetLibrarySpace';
import { BroadcastOverlayRenderer } from './components/overlays/BroadcastOverlayRenderer';
import { DirectCompositeRenderer } from './components/overlays/DirectCompositeRenderer';
import { INITIAL_COMPONENTS } from './constants/initialData';
import { matchingLiveSources } from './utils/liveSources';
import {addCustomGraphic,createCustomGraphic,createBlankGraphic,removeCustomGraphic,isCustomRegistry,CUSTOM_ID_PATTERN,matchesCustomOverlayUrl,customOverlayPath,defaultCustomSourceName} from './utils/componentRegistry';

export default function App() {
  // Check if loaded as an OBS Browser Source overlay: ?overlay=lower-third etc.
  const urlParams = new URLSearchParams(window.location.search);
  const overlayParamRaw = urlParams.get('overlay');
  const overlayParam = overlayParamRaw as ComponentType | null;
  const customOverlayId = urlParams.get('overlayId');

  // Single transparent page consumed by the Unity Capture compositor.
  // It contains every visible *published* graphic; no drafts are sent on air.
  if (overlayParamRaw === 'direct-program') return <DirectCompositeRenderer />;

  if (customOverlayId) {
    return CUSTOM_ID_PATTERN.test(customOverlayId)
      ? <BroadcastOverlayRenderer overlayType='banner' instanceId={customOverlayId} /> : null;
  }
  if (overlayParam && Object.hasOwn(INITIAL_COMPONENTS, overlayParam)) {
    return <BroadcastOverlayRenderer overlayType={overlayParam} />;
  }

  // Station Application State
  const [activeSpace, setActiveSpace] = useState<NavigationSpace>('inicio');
  const [studioFocusGraphic,setStudioFocusGraphic]=useState<string|null>(null);
  const [episode, setEpisode] = useState<EpisodeData>(() => StorageService.loadEpisode());
  const [components, setComponents] = useState<Record<ComponentType, EditorialComponentConfig>>(() =>
    StorageService.loadDraftComponents()
  );
  const [customComponents, setCustomComponents] = useState<CustomComponentRegistry>(() => StorageService.loadDraftCustomComponents());
  const [publishedComponents, setPublishedComponents] = useState<Record<ComponentType, EditorialComponentConfig>>(() => StorageService.loadComponents());
  const [publishedCustomComponents, setPublishedCustomComponents] = useState<CustomComponentRegistry>(() => StorageService.loadCustomComponents());
  const publishedRef = useRef(publishedComponents);
  const publishedCustomRef = useRef(publishedCustomComponents);
  const [publicationHistory, setPublicationHistory] = useState<PublicationHistory>({});
  const [publicationBusy, setPublicationBusy] = useState(false);
  const customRef = useRef(customComponents);
  const customRevision = useRef(0);
  const [countdown, setCountdown] = useState<CountdownState>(() => StorageService.loadCountdown());
  const [obsStatus, setObsStatus] = useState<OBSStatus>(() => obsService.getStatus());
  const [obsConfig, setObsConfig] = useState<OBSConnectionConfig>(() => obsService.getConfig());
  const [isProtectedMode, setIsProtectedMode] = useState(true);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [livePending, setLivePending] = useState<string[]>([]);
  const pendingLive = useRef(new Set<string>());
  const [transitionPending, setTransitionPending] = useState(false);
  const [scenePending, setScenePending] = useState(false);
  const sceneBusy = useRef(false);
  const transitionBusy = useRef(false);
  const [liveFeedback, setLiveFeedback] = useState('Conecta OBS y prepara una escena para comenzar.');
  const [componentSaveStatus, setComponentSaveStatus] = useState<'saved'|'saving'|'error'>('saved');
  const componentRevision = useRef(0);
  const componentsRef = useRef(components);
  // Preserve order of episode saves when quickly rearranging rundown or editing notes.
  const episodeSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushComponentChanges = async () => {
    const revision = componentRevision.current;
    setComponentSaveStatus('saving');
    try {
      await SharedStation.publish({ draftComponents: componentsRef.current });
      if (revision === componentRevision.current) setComponentSaveStatus('saved');
    } catch (err: any) {
      setComponentSaveStatus('error');
      showToast('error', 'No se pudo guardar el borrador', err.message);
    }
  };

  const scheduleComponentSave = (delayMs = 350) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void flushComponentChanges(); }, delayMs);
  };

  // Subscribe to OBS WebSocket status updates
  useEffect(() => {
    const unsubscribe = obsService.subscribe((newStatus) => {
      setObsStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  // Sync station and OBS Browser Sources through the local bridge. On first run,
  // migrate existing user data from localStorage without deleting it.
  useEffect(() => {
    let active = true;
    void SharedStation.read().then(async shared => {
      if (!active) return;
      if (!shared) {
        await SharedStation.publish({
          episode: StorageService.loadEpisode(),
          components: StorageService.loadComponents(),
          customComponents: StorageService.loadCustomComponents(),
          draftComponents: StorageService.loadDraftComponents(),
          draftCustomComponents: StorageService.loadDraftCustomComponents(),
          countdown: StorageService.loadCountdown(),
        });
      } else {
        if (shared.episode) { setEpisode(shared.episode); localStorage.setItem('stdq_obs_master_episode_v3', JSON.stringify(shared.episode)); }
        if (shared.components) {
          publishedRef.current = shared.components;
          setPublishedComponents(shared.components);
          StorageService.saveComponents(shared.components, false);
        }
        if (shared.customComponents && isCustomRegistry(shared.customComponents)) {
          publishedCustomRef.current = shared.customComponents;
          setPublishedCustomComponents(shared.customComponents);
          StorageService.saveCustomComponents(shared.customComponents, false);
        }
        if (shared.publicationHistory) setPublicationHistory(shared.publicationHistory);
        // Migration: the existing published records become the initial draft,
        // without changing what OBS Browser Sources receive.
        const incomingDraft = shared.draftComponents ?? shared.components;
        if (incomingDraft && componentRevision.current === 0) {
          const merged = { ...StorageService.loadDraftComponents(), ...incomingDraft };
          if (!merged['logo-bug']?.branding) merged['logo-bug'] = { ...merged['logo-bug'], branding: INITIAL_COMPONENTS['logo-bug'].branding };
          componentsRef.current = merged;
          setComponents(merged);
          StorageService.saveDraftComponents(merged);
        }
        const incomingCustomDraft = shared.draftCustomComponents ?? shared.customComponents;
        if (incomingCustomDraft && customRevision.current === 0 && isCustomRegistry(incomingCustomDraft)) {
          customRef.current = incomingCustomDraft;
          setCustomComponents(incomingCustomDraft);
          StorageService.saveDraftCustomComponents(incomingCustomDraft);
        }
        if (!shared.draftComponents || !shared.draftCustomComponents) {
          void SharedStation.publish({
            ...(!shared.draftComponents ? { draftComponents: componentRevision.current===0 ? (incomingDraft ?? componentsRef.current) : componentsRef.current } : {}),
            ...(!shared.draftCustomComponents ? { draftCustomComponents: customRevision.current===0 ? (incomingCustomDraft ?? customRef.current) : customRef.current } : {}),
          }).catch(err => showToast('warning', 'No se pudo migrar el borrador', err.message));
        }
        if (shared.countdown) { setCountdown(shared.countdown); localStorage.setItem('stdq_obs_master_countdown_v3', JSON.stringify(shared.countdown)); }
      }
    }).catch(err => showToast('warning', 'Sincronización local no disponible', err.message));
    return () => { active = false; };
  }, []);

  // Countdown by deadline rather than subtracting a second for each timer tick.
  useEffect(() => {
    if (!countdown.isRunning || countdown.isPaused || !countdown.deadlineMs) return;
    const id = window.setInterval(() => {
      setCountdown(prev => {
        if (!prev.isRunning || prev.isPaused || !prev.deadlineMs) return prev;
        const seconds = Math.max(0, Math.ceil((prev.deadlineMs - Date.now()) / 1000));
        if (seconds === prev.remainingSeconds) return prev;
        if (seconds === 0) {
          const finished = { ...prev, remainingSeconds: 0, isRunning: false, deadlineMs: undefined };
          StorageService.saveCountdown(finished);
          return finished;
        }
        return { ...prev, remainingSeconds: seconds };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [countdown.isRunning, countdown.isPaused, countdown.deadlineMs]);

  // Toast helper
  const showToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev.filter(item => item.title !== title), { id, type, title, message }].slice(-3));
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Handlers for components & OBS
  /** A graphic is ON AIR only after its real OBS source and bridge respond. */
  const handleToggleComponentVisibility = async (type: ComponentType | string, selectedSource?: string) => {
    if (pendingLive.current.has(type)) return;
    pendingLive.current.add(type);
    setLivePending([...pendingLive.current]);
    try {
      const isCustom = !!publishedCustomRef.current[type];
      const comp = isCustom ? publishedCustomRef.current[type] : publishedRef.current[type as ComponentType];
      if (!comp) throw new Error('Componente no disponible.');
      const status = obsService.getStatus();
      if (!status.connected) throw new Error('Conecta OBS antes de mostrar u ocultar gráficas.');
      const scene = status.scenes.find(item => item.name === status.currentProgramScene);
      if (!scene) throw new Error('No hay una escena Program confirmada en OBS.');
      const matches = matchingLiveSources(scene.sources, comp, comp.type, selectedSource);
      if (matches.length !== 1 || matches[0]?.type !== 'browser_source') throw new Error(matches.length === 0
        ? `No está vinculada la fuente «${comp.name}» en la escena «${scene.name}». Selecciona la fuente desde En Vivo.`
        : `No hay una única fuente de navegador válida para «${comp.name}». Vincula una Browser Source específica desde En Vivo.`);
      const source = matches[0];
      if(isCustom){
        const actualUrl=await obsService.browserSourceUrl(source.name);
        if(!matchesCustomOverlayUrl(actualUrl,comp.instanceId!))
          throw new Error(`La fuente «${source.name}» no usa la URL exclusiva de «${comp.name}». Copia su URL desde Content Studio o crea la fuente desde En Vivo.`);
      }
      const willBeVisible = !(comp.visibleInOBS && source.enabled);
      const updatedConfig = { ...comp, visibleInOBS: willBeVisible, updatedAt: new Date().toISOString() };
      const updated = isCustom
        ? addCustomGraphic(publishedCustomRef.current, updatedConfig)
        : { ...publishedRef.current, [type]: updatedConfig };
      if (willBeVisible) {
        // Enable OBS first, so we never announce a visible graphic without a source.
        await obsService.setSourceVisibility(scene.name, source.name, true);
        try { await SharedStation.publish(isCustom ? { customComponents: updated as CustomComponentRegistry } : { components: updated as Record<ComponentType, EditorialComponentConfig> }); }
        catch (err) {
          if (!source.enabled) await obsService.setSourceVisibility(scene.name, source.name, false).catch(() => undefined);
          throw err;
        }
      } else {
        await SharedStation.publish(isCustom ? { customComponents: updated as CustomComponentRegistry } : { components: updated as Record<ComponentType, EditorialComponentConfig> });
      }
      if (isCustom) {
        publishedCustomRef.current = updated as CustomComponentRegistry;
        
        setPublishedCustomComponents(publishedCustomRef.current);
        StorageService.saveCustomComponents(publishedCustomRef.current, false);
      } else {
        publishedRef.current = updated as Record<ComponentType, EditorialComponentConfig>;
        
        setPublishedComponents(publishedRef.current);
        StorageService.saveComponents(publishedRef.current, false);
      }
      if (!willBeVisible) {
        const exitMs = Math.min(2500, Math.max(50, Number(comp.animation?.exitDurationMs) || 350));
        await new Promise<void>(resolve => window.setTimeout(resolve, exitMs + 100));
        try { await obsService.setSourceVisibility(scene.name, source.name, false); }
        catch (err: any) {
          setLiveFeedback(`${comp.name}: oculto por HTML; OBS no pudo apagar la fuente.`);
          showToast('warning', 'Fuente OBS pendiente de ocultar', err.message);
          return;
        }
      }
      setLiveFeedback(`${comp.name}: ${willBeVisible ? 'visible' : 'oculto'} en ${scene.name}.`);
    } catch (err: any) {
      setLiveFeedback(`No se completó la operación: ${err.message}`);
      showToast('error', 'No se modificó la gráfica', err.message);
    } finally {
      pendingLive.current.delete(type);
      setLivePending([...pendingLive.current]);
    }
  };

  /** Replay the already-published animation; never edits its design or creates a revision. */
  const handleReplayGraphic = async (id:string,linkedName?:string) => {
    if(pendingLive.current.has(id))return;
    pendingLive.current.add(id);setLivePending([...pendingLive.current]);
    try{
      const custom=!!publishedCustomRef.current[id];
      const config=custom?publishedCustomRef.current[id]:publishedRef.current[id as ComponentType];
      const status=obsService.getStatus();
      const scene=status.scenes.find(s=>s.name===status.currentProgramScene);
      if(!config||!config.visibleInOBS||!status.connected||!scene)throw new Error('La gráfica no está confirmada en Program');
      const sources=matchingLiveSources(scene.sources,config,config.type,linkedName||config.obsSourceLinks?.[scene.name]);
      if(sources.length!==1||!sources[0].enabled)throw new Error('No hay una única fuente activa de esta gráfica');
      if(custom&&!matchesCustomOverlayUrl(await obsService.browserSourceUrl(sources[0].name),id))throw new Error('La URL OBS no pertenece a esta gráfica');
      const update={...config,animationReplay:(config.animationReplay??0)+1};
      if(custom){const next={...publishedCustomRef.current,[id]:update};await SharedStation.publish({customComponents:next});
        publishedCustomRef.current=next;setPublishedCustomComponents(next);StorageService.saveCustomComponents(next,false);
      }else{const next={...publishedRef.current,[id]:update};await SharedStation.publish({components:next});
        publishedRef.current=next;setPublishedComponents(next);StorageService.saveComponents(next,false);
      }
      setLiveFeedback(`${config.name}: animación repetida en Program.`);
    }catch(error){showToast('error','No se pudo repetir animación',error instanceof Error?error.message:undefined);}
    finally{pendingLive.current.delete(id);setLivePending([...pendingLive.current]);}
  };

  const handleHideAllComponents = async () => {
    if (pendingLive.current.size > 0) {
      showToast('warning', 'Espera a que terminen las operaciones de gráficas.');
      return;
    }
    const updatedCustom = Object.fromEntries(Object.entries(publishedCustomRef.current).map(([id, config]) => [id, {
      ...config, visibleInOBS: false, updatedAt: new Date().toISOString()
    }])) as CustomComponentRegistry;
    const updated = Object.fromEntries(Object.entries(publishedRef.current).map(([type, config]) => [type, {
      ...config, visibleInOBS: false, updatedAt: new Date().toISOString()
    }])) as Record<ComponentType, EditorialComponentConfig>;
    try {
      await SharedStation.publish({ components: updated, customComponents: updatedCustom });
      publishedCustomRef.current = updatedCustom;
      
      setPublishedCustomComponents(updatedCustom);
      StorageService.saveCustomComponents(updatedCustom,false);
      StorageService.saveComponents(updated, false);
      publishedRef.current = updated;
      
      setPublishedComponents(updated);
      if (obsStatus.connected) {
        let linkedSources: string[] = [];
        try { linkedSources = Object.values(JSON.parse(localStorage.getItem('stdq_live_source_links_v1') || '{}')).filter((value): value is string => typeof value === 'string'); }
        catch { /* Links are optional, panic still hides shared HTML overlays. */ }
        const customLinks = Object.values(updatedCustom).flatMap(comp => Object.values(comp.obsSourceLinks || {}));
        const report = await obsService.hideOverlaySources(updated, [...linkedSources,...customLinks]);
        showToast(report.failures.length ? 'warning' : 'success', 'Despejar gráficas',
          `${report.hidden} fuentes OBS ocultadas. ${report.failures.length ? report.failures.join(' · ') : 'Gráficas HTML desactivadas.'}`);
      } else {
        showToast('warning', 'Gráficas HTML desactivadas', 'OBS desconectado: no se pudo confirmar el apagado de las fuentes.');
      }
    } catch (err: any) {
      showToast('error', 'Error al despejar gráficas', err.message);
    }
  };

  const persistCustomRegistry = (registry:CustomComponentRegistry) => {
    customRef.current = registry;
    customRevision.current += 1;
    setCustomComponents(registry);
    StorageService.saveDraftCustomComponents(registry);
    const revision=++componentRevision.current;
    setComponentSaveStatus('saving');
    void SharedStation.publish({draftCustomComponents:registry})
      .then(()=>{if(componentRevision.current===revision)setComponentSaveStatus('saved');})
      .catch(err=>{setComponentSaveStatus('error');showToast('error','Error de guardado de gráficas personalizadas',err.message);});
  };

  const handleCreateCustomSource = async (id:string,sceneName:string):Promise<string>=>{
    const graphic=publishedCustomRef.current[id];
    if(!graphic)throw new Error('Publica la gráfica antes de crear su fuente OBS.');
    const sourceName=defaultCustomSourceName(id);
    const url=`${window.location.origin}${customOverlayPath(id)}`;
    await obsService.createCustomBrowserSource(sceneName,sourceName,url);
    showToast('success','Fuente OBS creada',`«${sourceName}» añadida en «${sceneName}» y desactivada por seguridad.`);
    return sourceName;
  };

  const handleCreateCustomComponent = (template:ComponentType|'blank', name:string):string => {
    const graphic=template==='blank' ? createBlankGraphic(componentsRef.current.editorial,name) : createCustomGraphic(componentsRef.current[template],name);
    persistCustomRegistry(addCustomGraphic(customRef.current,graphic));
    showToast('success','Nueva gráfica creada',`Configura una fuente Browser Source con la URL propia de «${graphic.name}».`);
    return graphic.instanceId!;
  };
  const handleRemoveCustomComponent = (id:string):void => {
    const config=customRef.current[id];
    if (!config) return;
    if (publishedCustomRef.current[id]) throw new Error('Esta gráfica ya fue publicada. Debe retirarse de la emisión y archivarse en una futura operación de retiro segura.');
    persistCustomRegistry(removeCustomGraphic(customRef.current,id));
    showToast('success','Gráfica eliminada',`Revisa si la fuente OBS «${config.name}» sigue en alguna escena.`);
  };

  const handleUpdateComponent = (updatedConfig: EditorialComponentConfig) => {
    if (updatedConfig.instanceId) {
      if (!customRef.current[updatedConfig.instanceId]) throw new Error('Esta gráfica ya no existe en el registro');
      persistCustomRegistry(addCustomGraphic(customRef.current, updatedConfig));
      return;
    }
    // Always start from the latest React edit (not from an outdated localStorage read).
    const updated = { ...componentsRef.current, [updatedConfig.type]: updatedConfig };
    componentsRef.current = updated;
    componentRevision.current += 1;
    setComponents(updated);
    StorageService.saveDraftComponents(updated);
    setComponentSaveStatus('saving');
    scheduleComponentSave();
  };

  const handlePublishGraphic = async (id: string) => {
    if (publicationBusy) return;
    setPublicationBusy(true);
    setComponentSaveStatus('saving');
    try {
      const liveConfig = id.startsWith('gfx-') ? publishedCustomRef.current[id] : publishedRef.current[id as ComponentType];
      if (liveConfig?.visibleInOBS) throw new Error('Esta gráfica figura al aire. Retírala antes de publicar.');
      // Fail closed if OBS shows the source in Program, even when the local flag is stale.
      const actualObs = obsService.getStatus();
      const program = actualObs.scenes.find(scene => scene.name === actualObs.currentProgramScene);
      if (actualObs.connected && program && liveConfig) {
        const active = program.sources.some(source => {
          if (!source.enabled) return false;
          if (id.startsWith('gfx-')) return matchingLiveSources([source],liveConfig,liveConfig.type).length>0 || Object.values(liveConfig.obsSourceLinks ?? {}).includes(source.name);
          return matchingLiveSources([source],liveConfig,liveConfig.type).length > 0;
        });
        if (active) throw new Error('OBS confirma que la fuente está visible en Program. Retírala antes de publicar.');
      }
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      const patch = id.startsWith('gfx-')
        ? { draftCustomComponents: customRef.current }
        : { draftComponents: componentsRef.current };
      await SharedStation.publish(patch);
      const result = await SharedStation.publishGraphic(id);
      if(!result.published) throw new Error('Servidor no confirmó el contenido publicado');
      if (id.startsWith('gfx-')) {
        const next = { ...publishedCustomRef.current, [id]: result.published };
        publishedCustomRef.current = next;
        setPublishedCustomComponents(next);
        StorageService.saveCustomComponents(next, false);
      } else {
        const next = { ...publishedRef.current, [id]: result.published };
        publishedRef.current = next;
        setPublishedComponents(next);
        StorageService.saveComponents(next, false);
      }
      setPublicationHistory(previous => {const next={...previous};if(result.history)next[id]=result.history;else delete next[id];return next;});
      setComponentSaveStatus('saved');
      showToast('success', 'Diseño publicado', `${id}: publicación completada sin crear revisiones.`);
    } catch (err: any) {
      setComponentSaveStatus('error');
      showToast('error', 'No se publicó la gráfica', err.message);
      throw err;
    } finally { setPublicationBusy(false); }
  };

  /** Every history operation is explicit and independent from publishing. */
  const handleManageGraphicRevision = async (id:string,action:'save'|'restore-draft'|'rename'|'remove'|'pin',version?:number,label?:string) => {
    if(publicationBusy)throw new Error('Hay otra operación pendiente');
    setPublicationBusy(true);
    try {
      if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}
      if(action==='save') await SharedStation.publish(id.startsWith('gfx-')?{draftCustomComponents:customRef.current}:{draftComponents:componentsRef.current});
      const result=await SharedStation.manageGraphicRevision(id,action,version,label);
      setPublicationHistory(previous=>{const next={...previous};if(result.history)next[id]=result.history;else delete next[id];return next;});
      if(action==='restore-draft'&&result.draft){
        const restored=result.draft;
        if(id.startsWith('gfx-')){
          const next={...customRef.current,[id]:restored};customRef.current=next;customRevision.current++;
          setCustomComponents(next);StorageService.saveDraftCustomComponents(next);
        }else{
          const next={...componentsRef.current,[id]:restored};componentsRef.current=next;componentRevision.current++;
          setComponents(next);StorageService.saveDraftComponents(next);
        }
      }
      setComponentSaveStatus('saved');
      showToast('success',action==='save'?'Versión guardada':action==='restore-draft'?'Recuperada al borrador':'Historial actualizado',
        action==='restore-draft'?'La versión publicada permanece intacta.':undefined);
    }catch(error){showToast('error','Operación del historial fallida',error instanceof Error?error.message:undefined);throw error;}
    finally{setPublicationBusy(false);}
  };

  /** Updates to OBS source associations are operational metadata, never design publication. */
  const handleUpdateCustomSourceLink = (config: EditorialComponentConfig) => {
    const id = config.instanceId;
    if (!id || !publishedCustomRef.current[id]) return;
    const next = { ...publishedCustomRef.current, [id]: {
      ...publishedCustomRef.current[id], obsSourceLinks: config.obsSourceLinks, updatedAt: new Date().toISOString(),
    }};
    publishedCustomRef.current = next;
    setPublishedCustomComponents(next);
    StorageService.saveCustomComponents(next, false);
    const draft = customRef.current[id];
    if (draft) {
      const nextDraft = { ...customRef.current, [id]: { ...draft, obsSourceLinks: config.obsSourceLinks } };
      customRef.current = nextDraft;
      setCustomComponents(nextDraft);
      StorageService.saveDraftCustomComponents(nextDraft);
    }
    void SharedStation.publish({ customComponents: next,
      ...(draft ? { draftCustomComponents: customRef.current } : {}),
    }).catch(err => showToast('error', 'No se guardó la vinculación OBS', err.message));
  };

  const handleUpdateEpisode = (updatedEpisode: EpisodeData) => {
    setEpisode(updatedEpisode);
    StorageService.saveEpisode(updatedEpisode);
    episodeSaveQueue.current = episodeSaveQueue.current.catch(() => undefined)
      .then(() => LibraryService.saveEpisode(updatedEpisode))
      .catch(err => showToast('warning', 'Episodio activo actualizado, pero no archivado', err.message));
  };

  const handleRestoreSnapshot = (snapshot: BroadcastStateSnapshot) => {
    StorageService.restoreSnapshot(snapshot);
    // Library restoration is handled by Biblioteca before invoking this callback.
    // Avoid running a second asynchronous replace that could overwrite newer edits.
    void LibraryService.saveEpisode(snapshot.episode).catch(err =>
      showToast('warning', 'Episodio recuperado, pero el catálogo no confirmó el guardado', err.message)
    );
    setEpisode(snapshot.episode);
    if (snapshot.customComponents && isCustomRegistry(snapshot.customComponents)) {
      customRef.current=snapshot.customComponents;
      customRevision.current += 1;
      setCustomComponents(snapshot.customComponents);
    }
    componentsRef.current = snapshot.components;
    componentRevision.current += 1;
    setComponents(snapshot.components);
    showToast('info', 'Biblioteca recuperada como borrador', 'Usa Publicar en Content Studio para llevar las gráficas a OBS.');
    if (snapshot.countdown) {
      setCountdown(snapshot.countdown);
    }
  };

  // Every control must wait for the OBS acknowledgement before showing success.
  const handleSetProgramScene = async (sceneName: string) => {
    if (sceneBusy.current || transitionBusy.current) return false;
    if (isProtectedMode) {
      showToast('warning', 'Modo protegido activo', 'Desactívalo para cambiar directamente la escena al aire.');
      return false;
    }
    sceneBusy.current = true; setScenePending(true);
    try {
      await obsService.setProgramScene(sceneName);
      setLiveFeedback(`Program: escena «${sceneName}» confirmada por OBS.`);
      return true;
    } catch (err: any) {
      showToast('error', 'No cambió la escena', err.message);
      setLiveFeedback(`Error al enviar escena: ${err.message}`);
      return false;
    } finally { sceneBusy.current = false; setScenePending(false); }
  };

  const handleSetPreviewScene = async (sceneName: string) => {
    if (sceneBusy.current || transitionBusy.current) return false;
    sceneBusy.current = true; setScenePending(true);
    try {
      await obsService.setPreviewScene(sceneName);
      setLiveFeedback(`Preview: «${sceneName}» preparado.`);
      return true;
    } catch (err: any) {
      showToast('error', 'No se preparó Preview', err.message);
      setLiveFeedback(`Error de Preview: ${err.message}`);
      return false;
    } finally { sceneBusy.current = false; setScenePending(false); }
  };

  const handleExecuteTransition = async (transitionType: string = '') => {
    if (transitionBusy.current || sceneBusy.current) return;
    transitionBusy.current = true;
    setTransitionPending(true);
    try {
      const name = transitionType || obsService.getStatus().currentTransitionName;
      if (!name) throw new Error('Selecciona una transición disponible en OBS.');
      await obsService.executeTransition(name);
      setLiveFeedback(`Transición «${name}» confirmada por OBS.`);
    } catch (err: any) {
      setLiveFeedback(`Transición no completada: ${err.message}`);
      showToast('error', 'No se realizó la transición', err.message);
    } finally { transitionBusy.current = false; setTransitionPending(false); }
  };

  const handleToggleVirtualCam = async () => {
    if (isProtectedMode && obsStatus.virtualCamActive) {
      showToast('warning', 'Salida protegida', 'Desactiva el modo protegido para detener la cámara virtual.');
      return;
    }
    try {
      const active = await obsService.toggleVirtualCam();
      showToast('success', active ? 'Cámara virtual activada en OBS' : 'Cámara virtual detenida en OBS');
    } catch (err: any) { showToast('error', 'No se modificó la cámara virtual', err.message); }
  };

  const handleToggleStudioMode = async () => {
    if (isProtectedMode && obsStatus.studioMode) {
      showToast('warning', 'Modo protegido activo', 'Desactiva la protección antes de abandonar Modo Estudio.');
      return;
    }
    try {
      const enabled = await obsService.toggleStudioMode();
      showToast('success', enabled ? 'Modo Estudio activo' : 'Modo Estudio desactivado');
    } catch (err: any) { showToast('error', 'No se modificó Modo Estudio', err.message); }
  };

  const handleStartCountdown = (seconds: number) => {
    const updated: CountdownState = {
      ...countdown,
      durationSeconds: seconds,
      remainingSeconds: seconds,
      isRunning: true,
      isPaused: false,
      deadlineMs: Date.now() + seconds * 1000,
    };
    setCountdown(updated);
    StorageService.saveCountdown(updated);
    showToast('info', 'Cuenta Regresiva Iniciada', `${Math.round(seconds / 60)} minutos restantes.`);
  };

  const handlePauseCountdown = () => {
    const paused = countdown.isRunning && !countdown.isPaused;
    const remainingSeconds = paused && countdown.deadlineMs
      ? Math.max(0, Math.ceil((countdown.deadlineMs - Date.now()) / 1000))
      : countdown.remainingSeconds;
    const updated: CountdownState = {
      ...countdown,
      remainingSeconds,
      isRunning: !paused && remainingSeconds > 0,
      isPaused: paused,
      deadlineMs: paused ? undefined : Date.now() + remainingSeconds * 1000,
    };
    setCountdown(updated);
    StorageService.saveCountdown(updated);
  };

  const handleResetCountdown = () => {
    const updated: CountdownState = {
      ...countdown,
      remainingSeconds: countdown.durationSeconds,
      isRunning: false,
      isPaused: false,
      deadlineMs: undefined,
    };
    setCountdown(updated);
    StorageService.saveCountdown(updated);
    showToast('info', 'Cuenta Regresiva Restablecida');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090A0E] text-slate-100 overflow-hidden font-sans">
      {/* Apple HIG Header Navigation */}
      <Header
        activeSpace={activeSpace}
        onNavigate={setActiveSpace}
        obsStatus={obsStatus}
        isProtectedMode={isProtectedMode}
        onToggleProtectedMode={() => setIsProtectedMode(!isProtectedMode)}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onToggleVirtualCam={handleToggleVirtualCam}
        episodeNumber={episode.number}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeSpace === 'inicio' && (
          <MissionControlSpace
            episode={episode}
            obsStatus={obsStatus}
            obsConfig={obsConfig}
            customComponents={publishedCustomComponents}
            countdown={countdown}
            components={publishedComponents}
            onNavigate={setActiveSpace}
            onStartCountdown={handleStartCountdown}
            onPauseCountdown={handlePauseCountdown}
            onResetCountdown={handleResetCountdown}
            onToggleComponentVisibility={handleToggleComponentVisibility}
            onHideAllComponents={handleHideAllComponents}
            onSetProgramScene={handleSetProgramScene}
            onToggleVirtualCam={handleToggleVirtualCam}
            onUpdateObsConfig={(newCfg) => {
              setObsConfig((prev) => ({ ...prev, ...newCfg }));
              obsService.updateConfig(newCfg);
            }}
            onConnectObs={async (overrideConfig) => {
              if (overrideConfig) {
                setObsConfig((prev) => ({ ...prev, ...overrideConfig }));
              }
              return await obsService.connect(overrideConfig);
            }}
            onDisconnectObs={() => {
              obsService.disconnect();
              showToast('info', 'Desconectado de OBS Studio');
            }}
            onShowToast={showToast}
          />
        )}

        {activeSpace === 'preparacion' && (
          <PreflightRundownSpace
            episode={episode}
            components={components}
            customComponents={customComponents}
            obsStatus={obsStatus}
            onUpdateEpisode={handleUpdateEpisode}
            onUpdateComponent={handleUpdateComponent}
            onSetPreviewScene={handleSetPreviewScene}
            onSetProgramScene={handleSetProgramScene}
          />
        )}

        {activeSpace === 'en-vivo' && (
          <BroadcastControlSpace
            episode={episode}
            obsStatus={obsStatus}
            countdown={countdown}
            components={publishedComponents}
            customComponents={publishedCustomComponents}
            onCreateCustomSource={handleCreateCustomSource}
            onUpdateCustomSourceLink={handleUpdateCustomSourceLink}
            isProtectedMode={isProtectedMode}
            pendingComponents={livePending}
            transitionPending={transitionPending}
            scenePending={scenePending}
            liveFeedback={liveFeedback}
            onSetPreviewScene={handleSetPreviewScene}
            onSetProgramScene={handleSetProgramScene}
            onExecuteTransition={handleExecuteTransition}
            onToggleComponentVisibility={handleToggleComponentVisibility}
            onReplayGraphic={handleReplayGraphic}
            onEditGraphic={id=>{setStudioFocusGraphic(id);setActiveSpace('content-studio');}}
            onHideAllComponents={handleHideAllComponents}
            onStartCountdown={handleStartCountdown}
            onPauseCountdown={handlePauseCountdown}
            onResetCountdown={handleResetCountdown}
            onToggleVirtualCam={handleToggleVirtualCam}
            onToggleStudioMode={handleToggleStudioMode}
          />
        )}

        {activeSpace === 'content-studio' && (
          <ContentStudioSpace
            components={components}
            customComponents={customComponents}
            onCreateCustom={handleCreateCustomComponent}
            onRemoveCustom={handleRemoveCustomComponent}
            onUpdateComponent={handleUpdateComponent}
            saveStatus={componentSaveStatus}
            onRetrySave={() => {
              setComponentSaveStatus('saving');
              void SharedStation.publish({draftComponents: componentsRef.current,draftCustomComponents:customRef.current})
                .then(()=>setComponentSaveStatus('saved'))
                .catch(err=>{setComponentSaveStatus('error');showToast('error','No se pudo guardar borrador',err.message);});
            }}
            publishedComponents={publishedComponents}
            publishedCustomComponents={publishedCustomComponents}
            publicationHistory={publicationHistory}
            publicationBusy={publicationBusy}
            onPublishGraphic={handlePublishGraphic}
            onManageRevision={handleManageGraphicRevision}
            focusGraphicId={studioFocusGraphic}
            onToggleVisibility={handleToggleComponentVisibility}
            onSendToOBS={handleToggleComponentVisibility}
          />
        )}

        {activeSpace === 'biblioteca' && (
          <AssetLibrarySpace
            episode={episode}
            components={components}
            customComponents={customComponents}
            countdown={countdown}
            onUpdateEpisode={handleUpdateEpisode}
            onUpdateComponent={handleUpdateComponent}
            onRestoreSnapshot={handleRestoreSnapshot}
            onShowToast={showToast}
          />
        )}
      </div>

      {/* Connection & Setup Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        status={obsStatus}
        config={obsConfig}
        onConnect={async (newConfig) => {
          setObsConfig(newConfig);
          const connected = await obsService.connect(newConfig);
          showToast(connected ? 'success' : 'error', connected ? 'OBS autenticado correctamente' : 'OBS no confirmó la conexión');
        }}
      />

      {/* Floating System Toasts */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
