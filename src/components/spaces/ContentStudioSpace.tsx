import React, { useState, useEffect, useRef } from 'react';
import { 
  EditorialComponentConfig, 
  ComponentType, 
  FontSettings, 
  GeometrySettings, 
  AnimationSettings, 
  AnimationPreset,
  CustomComponentRegistry
} from '../../types';
import { GraphicComponentRenderer } from '../overlays/GraphicComponentRenderers';
import { BrandLogoLayer, DefaultBranding } from '../overlays/BrandLogoLayer';
import { uploadLogo } from '../../services/logoUpload';
import { LibraryService } from '../../services/libraryService';
import { DEFAULT_COMPONENT_GLYPH } from '../overlays/ComponentGlyph';
import { tickerSeconds } from '../../utils/tickerMotion';
import { moveBox, resizeBox } from '../../utils/editorGeometry';
import {resizeByCorner,rotateByPointer} from '../../utils/transformHandles';
import { LayerEditorPanel } from './LayerEditorPanel';
import { ComponentGeometryInspector } from '../studio/ComponentGeometryInspector';
import { SocialNetworksEditor } from '../studio/SocialNetworksEditor';
import { contentFieldsFor, parseContentValue } from '../../utils/contentSchema';
import {SmartInspector} from '../studio/SmartInspector';
import {StudioCommandPalette} from '../studio/StudioCommandPalette';
import type {StudioCommand} from '../studio/StudioCommandPalette';
import { NumericControl,ColorControl } from '../studio/PrecisionControls';
import { WorkspaceLayerTree } from './WorkspaceLayerTree';
import { DEFAULT_WORKSPACE_PREFERENCES, resolveWorkspacePreferences, clampWorkspaceZoom, fitCanvasWidth } from '../../utils/workspaceView';
import type {WorkspacePreferences, WorkspaceTool} from '../../utils/workspaceView';
import { editableTemplateLayersFor, makeGraphicLayer, moveGraphicLayer } from '../../utils/graphicLayers';
import {layerIds,selectLayer,membersOfGroup,moveSelection,assignGroup,alignSelection,distributeSelection,duplicateCustomSelection,isLocked} from '../../utils/workspaceEditing';
import type {LayerRects,AlignAction,DistributionAxis} from '../../utils/workspaceEditing';
import {createHistory,pushHistory,stepHistory,historyFlags} from '../../utils/editorHistory';
import type {EditHistory} from '../../utils/editorHistory';
import {snapRect} from '../../utils/editorSnap';
import type {Rect} from '../../utils/editorSnap';
import type {Guide} from '../../utils/editorSnap';
import {useLayerTimeline} from '../../hooks/useLayerTimeline';
import {motion as Motion, AnimatePresence} from 'motion/react';
import {componentMotionProps, motionReplayKey} from '../../utils/animationEngine';
import type { GraphicLayer, LayerOverride, MediaAsset } from '../../types';
import { 
  Sparkles, 
  Eye, 
  EyeOff, 
  Layers, 
  Type, 
  Maximize2, 
  Play, 
  Radio, 
  Copy, 
  Check, 
  RotateCcw, 
  Grid, 
  ShieldCheck, 
  Sliders, 
  Palette,
  ExternalLink,
  ChevronDown, Undo2, Redo2, Magnet, PlayCircle, MousePointer2, Hand, Minus, Plus, Scan, Ruler,
  Search, Command, Keyboard, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Focus, MonitorPlay, Group, Ungroup, CopyPlus, AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal, Columns3, Rows3, ImagePlus
} from 'lucide-react';
import { BROADCAST_SAFE_ZONES } from '../../utils/animationEngine';
import {customOverlayPath} from '../../utils/componentRegistry';
import type {PublicationHistory} from '../../utils/publicationEngine';

interface ContentStudioSpaceProps {
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents: CustomComponentRegistry;
  onCreateCustom: (template:ComponentType|'blank',name:string)=>string;
  onRemoveCustom: (instanceId:string)=>void;
  onUpdateComponent: (config: EditorialComponentConfig) => void;
  onToggleVisibility: (type: string) => void;
  onSendToOBS: (type: string) => void;
  publishedComponents: Record<ComponentType, EditorialComponentConfig>;
  publishedCustomComponents: CustomComponentRegistry;
  publicationHistory: PublicationHistory;
  publicationBusy: boolean;
  onPublishGraphic: (id: string) => Promise<void>;
  focusGraphicId?:string|null;
  onManageRevision: (id:string,action:'save'|'restore-draft'|'rename'|'remove'|'pin',version?:number,label?:string)=>Promise<void>;
  saveStatus: 'saved' | 'saving' | 'error';
  onRetrySave: () => void;
}

export const ContentStudioSpace: React.FC<ContentStudioSpaceProps> = ({
  components,
  customComponents,
  onCreateCustom,
  onRemoveCustom,
  onUpdateComponent,
  onToggleVisibility,
  onSendToOBS,
  saveStatus,
  onRetrySave,
  publishedComponents,
  publishedCustomComponents,
  publicationHistory,
  publicationBusy,
  onPublishGraphic,
  onManageRevision,
  focusGraphicId,
}) => {
  // Preferences affect this editor only, never the broadcast component or Browser Source.
  const [initialWorkspace] = useState<WorkspacePreferences>(()=>{
    try { return resolveWorkspacePreferences(JSON.parse(localStorage.getItem('stdq-content-workspace-v1')||'null')); }
    catch { return {...DEFAULT_WORKSPACE_PREFERENCES}; }
  });
  const [zoom,setZoom] = useState(initialWorkspace.zoom);
  const [pan,setPan] = useState({x:0,y:0});
  const [tool,setTool] = useState<WorkspaceTool>('select');
  const [holdingSpace,setHoldingSpace] = useState(false);
  const holdingSpaceRef=useRef(false);
  const panRef=useRef<{x:number;y:number;startX:number;startY:number;id:number}|null>(null);
  const [isPanning,setIsPanning] = useState(false);
  const [componentSearch,setComponentSearch] = useState('');
  const [showRulers,setShowRulers] = useState(initialWorkspace.rulers);
  const [focusMode,setFocusMode] = useState(initialWorkspace.focus);
  const [previewOnly,setPreviewOnly] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState<ComponentType>('lower-third');
  const [selectedCustomId,setSelectedCustomId] = useState<string|null>(null);
  const [createOpen,setCreateOpen] = useState(false);
  const [newGraphicName,setNewGraphicName] = useState('');
  const [newGraphicTemplate,setNewGraphicTemplate] = useState<ComponentType|'blank'>('blank');
  const customSelected = selectedCustomId ? customComponents[selectedCustomId] : undefined;
  const selectedConfig = customSelected || components[selectedType];
  const selectionKey = selectedCustomId || selectedType;
  useEffect(()=>{
    if(!focusGraphicId)return;
    if(customComponents[focusGraphicId]){
      setSelectedCustomId(focusGraphicId);setSelectedType(customComponents[focusGraphicId].type);
    }else if(focusGraphicId in components){setSelectedCustomId(null);setSelectedType(focusGraphicId as ComponentType);}
  },[focusGraphicId]);
  const publishedSelected = selectedCustomId ? publishedCustomComponents[selectedCustomId] : publishedComponents[selectedType];
  const timeline = publicationHistory[selectionKey];
  const [historySelection,setHistorySelection] = useState<number | ''>('');
  const [historyActionsOpen,setHistoryActionsOpen]=useState(false);
  const [comparePublished,setComparePublished] = useState(false);
  const [commandOpen,setCommandOpen] = useState(false);
  // A comparison belongs to the current document only; never carry its locks
  // or preview styling over when another graphic is selected.
  useEffect(() => { setComparePublished(false); setPreviewOnly(false); setHistoryActionsOpen(false);setHistorySelection(''); }, [selectionKey]);
  const [publicationMessage,setPublicationMessage] = useState('');
  const compareDesign=(config?:EditorialComponentConfig)=>{
    if(!config)return '';
    const {visibleInOBS: _visible,animationReplay: _replay,updatedAt: _updated,obsSourceLinks: _links,...design}=config;
    return JSON.stringify(design);
  };
  const draftDifferent = compareDesign(selectedConfig) !== compareDesign(publishedSelected);
  const canvasConfig = comparePublished && publishedSelected ? publishedSelected : selectedConfig;
  const publishSelected = async () => {
    if (!window.confirm(`¿PUBLICAR el borrador de «${selectedConfig.name}»?\n\nSe actualizará OBS sin crear otra versión. Comprueba que no esté al aire.`)) return;
    setPublicationMessage('');
    try { await onPublishGraphic(selectionKey); setComparePublished(false); }
    catch(e){ setPublicationMessage(e instanceof Error ? e.message : 'No se pudo publicar'); }
  };
  const manageHistory=async(action:'save'|'restore-draft'|'rename'|'remove'|'pin')=>{
    const selected=timeline?.revisions.find(r=>r.version===historySelection);
    if(action!=='save'&&!selected)return;
    let name: string|undefined;
    if(action==='save'){
      const value=window.prompt('Nombre de esta versión (opcional)',`Diseño ${new Date().toLocaleString('es-CL')}`);
      if(value===null)return;name=value;
    }
    if(action==='rename'){
      const value=window.prompt('Nuevo nombre de la versión',selected?.label||`Versión ${selected?.version}`);
      if(value===null)return;name=value;
    }
    if(action==='restore-draft'&&!window.confirm('¿Recuperar esta versión SOLO AL BORRADOR? No modifica lo publicado ni genera versiones. El borrador actual se reemplazará.'))return;
    if(action==='remove'&&!window.confirm(`¿Eliminar la versión ${selected?.version}? Esta acción no tiene deshacer.`))return;
    setPublicationMessage('');
    try{
      await onManageRevision(selectionKey,action,selected?.version,name);
      if(action==='remove'||action==='restore-draft')setHistorySelection('');
      if(action==='restore-draft'){setComparePublished(false);setPreviewOnly(false);selectIds([]);}
    }catch(e){setPublicationMessage(e instanceof Error?e.message:'No se pudo gestionar el historial');}
  };
  const selectTemplate=(type:ComponentType)=>{setSelectedCustomId(null);setSelectedType(type);};
  const selectCustom=(id:string)=>{const graphic=customComponents[id];if(!graphic)return;setSelectedType(graphic.type);setSelectedCustomId(id);};
  const submitNewGraphic=(event:React.FormEvent)=>{
    event.preventDefault();
    try{
      const id=onCreateCustom(newGraphicTemplate,newGraphicName);
      selectCustomAfterCreate(id,newGraphicTemplate==='blank'?'editorial':newGraphicTemplate);
    } catch(e){window.alert(e instanceof Error?e.message:'No fue posible crear la gráfica');}
  };
  const selectCustomAfterCreate=(id:string,type:ComponentType)=>{
    setSelectedType(type);setSelectedCustomId(id);setCreateOpen(false);setNewGraphicName('');
  };
  const [selectedLayerId, setSelectedLayerId] = useState<string|null>(null);
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const selectIds=(ids:string[])=>{setSelectedIds(ids);setSelectedLayerId(ids.at(-1)??null);};
  const selectOne=(id:string|null,extend=false)=>{
    if(!id){selectIds([]);return;}
    selectIds(selectLayer(selectedConfig,selectedIds,id,extend?'toggle':'replace'));
  };
  const [panelWidths,setPanelWidths]=useState(()=>{
    try{const saved=JSON.parse(localStorage.getItem('stdq-content-panel-widths-v1')||'{}');return {left:Math.max(240,Math.min(440,Number(saved.left)||288)),right:Math.max(300,Math.min(560,Number(saved.right)||352))};}
    catch{return {left:288,right:352};}
  });
  const panelDragRef=useRef<{side:'left'|'right';startX:number;value:number;pointerId:number}|null>(null);
  const [assetBusy,setAssetBusy]=useState(false);
  const [assetError,setAssetError]=useState('');
  const [assetDrag,setAssetDrag]=useState(false);
  const [assetDrawer,setAssetDrawer]=useState(false);
  const [studioAssets,setStudioAssets]=useState<MediaAsset[]>([]);
  const [assetLibraryLoading,setAssetLibraryLoading]=useState(false);
  const refreshStudioAssets=async()=>{
    setAssetLibraryLoading(true);setAssetError('');
    try{const catalog=await LibraryService.read();setStudioAssets(catalog.assets.filter(a=>a.type==='image'&&!a.isMissing));}
    catch(e){setAssetError(e instanceof Error?e.message:'No se pudo cargar la Biblioteca.');}
    finally{setAssetLibraryLoading(false);}
  };
  const toggleAssetDrawer=()=>{const next=!assetDrawer;setAssetDrawer(next);if(next)void refreshStudioAssets();};

  const historyRef=useRef(new Map<string, EditHistory<EditorialComponentConfig>>());
  const [historyVersion,setHistoryVersion]=useState(0);
  const [snapEnabled,setSnapEnabled]=useState(initialWorkspace.snap);
  const [snapGuides,setSnapGuides]=useState<Guide[]>([]);
  const [timelineReplay,setTimelineReplay]=useState(0);
  const [previewPhase,setPreviewPhase]=useState<'show'|'hide'>('show');
  const sequenceTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearSequence=()=>{sequenceTimers.current.forEach(clearTimeout);sequenceTimers.current=[];};
  useEffect(()=>()=>{sequenceTimers.current.forEach(clearTimeout);},[]);
  const playPreview=(includeExit=false)=>{
    clearSequence();
    setPreviewPhase('show');
    setTimelineReplay(v=>v+1);
    if(includeExit){
      const settings=selectedConfig.animation;
      const untilExit=Math.max(0,settings.delayMs)+Math.max(0,settings.entryDurationMs)+1400;
      sequenceTimers.current.push(setTimeout(()=>setPreviewPhase('hide'),untilExit));
      sequenceTimers.current.push(setTimeout(()=>setPreviewPhase('show'),untilExit+Math.max(100,settings.exitDurationMs)+200));
    }
  };
  const history=historyRef.current.get(selectionKey);
  const flags=history ? historyFlags(history):{canUndo:false,canRedo:false};
  const stepEdit=(direction:-1|1)=>{
    if (comparePublished) return;
    const current=historyRef.current.get(selectionKey);
    if(!current)return;
    const result=stepHistory(current,direction);
    if(!result.value)return;
    historyRef.current.set(selectionKey,result.state);
    setHistoryVersion(x=>x+1);
    onUpdateComponent({...result.value,updatedAt:new Date().toISOString()});
  };
  const applyEdit=(patch:Partial<EditorialComponentConfig>,group:string|null=null)=>{
    if (comparePublished) return; // The published comparison is strictly read-only.
    const next={...selectedConfig,...patch,updatedAt:new Date().toISOString()};
    const previous=historyRef.current.get(selectionKey)??createHistory(selectedConfig);
    historyRef.current.set(selectionKey,pushHistory(previous,next,group));
    setHistoryVersion(v=>v+1);
    onUpdateComponent(next);
  };

  const [layerRect, setLayerRect] = useState<{left:number;top:number;width:number;height:number}|null>(null);
  const [selectionBoxes,setSelectionBoxes] = useState<Record<string,{left:number;top:number;width:number;height:number}>>({});
  const elementRef = useRef<HTMLDivElement>(null);
  useLayerTimeline(elementRef,canvasConfig,timelineReplay,timelineReplay>0 && previewPhase==='show');
  const previewMotion=componentMotionProps(canvasConfig.animation);
  useEffect(()=>{setSelectedLayerId(null);setSelectedIds([]);setLayerRect(null);clearSequence();setPreviewPhase('show');setTimelineReplay(v=>v+1);},[selectedType,selectedCustomId]);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'smart' | 'content' | 'design' | 'geometry' | 'animation' | 'branding' | 'broadcast' | 'layers'>('smart');
  const [showSafeZones, setShowSafeZones] = useState(initialWorkspace.safeZones);
  const [showGrid, setShowGrid] = useState(initialWorkspace.grid);
  const [canvasBg, setCanvasBg] = useState<'dark' | 'transparent' | 'camera'>(initialWorkspace.background);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGlyph, setUploadingGlyph] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(960);
  const visualWidth = previewWidth * zoom / 100;
  useEffect(()=>{
    try { localStorage.setItem('stdq-content-workspace-v1',JSON.stringify({zoom,grid:showGrid,rulers:showRulers,safeZones:showSafeZones,snap:snapEnabled,focus:focusMode,background:canvasBg})); }
    catch { /* Editor remains usable if browser preferences are unavailable. */ }
  },[zoom,showGrid,showRulers,showSafeZones,snapEnabled,focusMode,canvasBg]);
  const zoomBy=(step:number)=>setZoom(z=>clampWorkspaceZoom(z+step));
  const resetView=()=>{setZoom(100);setPan({x:0,y:0});};
  // Single-entry production-friendly command access. Never changes published documents.
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen(value => !value);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const commands: StudioCommand[] = [
    {id:'fit',label:'Ajustar lienzo',description:'Volver al centro y al 100% de zoom',shortcut:'0',run:resetView},
    {id:'zoom-in',label:'Acercar lienzo',description:'Zoom +25%',shortcut:'+',run:()=>zoomBy(25)},
    {id:'zoom-out',label:'Alejar lienzo',description:'Zoom −25%',shortcut:'−',run:()=>zoomBy(-25)},
    {id:'guides',label:showSafeZones?'Ocultar zonas seguras':'Mostrar zonas seguras',description:'Guías para proteger textos en pantalla',run:()=>setShowSafeZones(v=>!v)},
    {id:'grid',label:showGrid?'Ocultar cuadrícula':'Mostrar cuadrícula',description:'Referencia geométrica del escenario',run:()=>setShowGrid(v=>!v)},
    {id:'rulers',label:showRulers?'Ocultar reglas':'Mostrar reglas',description:'Medición en píxeles',run:()=>setShowRulers(v=>!v)},
    {id:'snap',label:snapEnabled?'Desactivar ajuste inteligente':'Activar ajuste inteligente',description:'Alineación magnética de las capas',run:()=>setSnapEnabled(v=>!v)},
    {id:'published',label:comparePublished?'Volver al borrador':'Comparar versión publicada',description:'Comparación visual privada, nunca emitir',disabled:!publishedSelected,run:()=>{setComparePublished(!comparePublished);setPreviewOnly(!comparePublished);selectIds([]);}},
    {id:'focus',label:focusMode?'Mostrar paneles':'Enfocar lienzo',description:'Ocultar o mostrar paneles laterales',run:()=>setFocusMode(v=>!v)},
    {id:'layers',label:'Abrir inspector de capas',description:'Gestionar orden y propiedades de las capas',run:()=>{setFocusMode(false);setActiveInspectorTab('layers');}},
    {id:'motion',label:'Vista previa de animación',description:'Reproducir Motion en el editor, sin emitir',run:()=>playPreview(true)},
  ];
  const openLayers=()=>setActiveInspectorTab('smart');
  useEffect(()=>{try{localStorage.setItem('stdq-content-panel-widths-v1',JSON.stringify(panelWidths));}catch{}},[panelWidths]);
  const beginPanelDrag=(e:React.PointerEvent<HTMLDivElement>,side:'left'|'right')=>{
    if(e.button!==0)return;
    e.preventDefault();panelDragRef.current={side,startX:e.clientX,value:panelWidths[side],pointerId:e.pointerId};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const movePanelDrag=(e:React.PointerEvent<HTMLDivElement>)=>{
    const drag=panelDragRef.current;if(!drag||drag.pointerId!==e.pointerId)return;
    const direction=drag.side==='left'?1:-1;
    const next=Math.max(drag.side==='left'?240:300,Math.min(drag.side==='left'?440:560,drag.value+(e.clientX-drag.startX)*direction));
    setPanelWidths(old=>({...old,[drag.side]:Math.round(next)}));
  };
  const endPanelDrag=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(panelDragRef.current?.pointerId!==e.pointerId)return;
    panelDragRef.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const measureLayers=():LayerRects=>{
    const root=elementRef.current;
    if(!root)return {};
    // CSS scales each template element by canvas fit, component scale and viewport zoom.
    const factor=Math.max(.001,previewWidth/1920 * selectedConfig.geometry.scale * zoom/100);
    const origin=root.getBoundingClientRect();
    const rects:LayerRects={};
    root.querySelectorAll<HTMLElement>('[data-stdq-layer]').forEach(node=>{
      const id=node.dataset.stdqLayer;
      if(!id)return;
      const r=node.getBoundingClientRect();
      if(r.width<=0||r.height<=0)return;
      rects[id]={x:(r.left-origin.left)/factor,y:(r.top-origin.top)/factor,width:r.width/factor,height:r.height/factor};
    });
    return rects;
  };
  const groupSelected=()=>{
    if(selectedIds.length<2)return;
    const groupId=`group-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    handleUpdate(assignGroup(selectedConfig,selectedIds,groupId));
  };
  const ungroupSelected=()=>{
    if(!selectedIds.length)return;
    handleUpdate(assignGroup(selectedConfig,selectedIds,undefined));
  };
  const alignSelected=(action:AlignAction)=>{
    if(selectedIds.length<2)return;
    handleUpdate(alignSelection(selectedConfig,selectedIds,measureLayers(),action));
  };
  const distributeSelected=(axis:DistributionAxis)=>{
    if(selectedIds.length<3)return;
    handleUpdate(distributeSelection(selectedConfig,selectedIds,measureLayers(),axis));
  };
  const duplicateSelected=()=>{
    const result=duplicateCustomSelection(selectedConfig,selectedIds,()=>`layer-${Date.now()}-${Math.random().toString(36).slice(2,9)}`);
    if(!result.ids.length)return;
    handleUpdate(result.patch);selectIds(result.ids);openLayers();
  };
  const addAssetToCanvas=(assetUrl:string,name:string)=>{
    if(comparePublished)return;
    if(!/^\/api\/station\/(?:media\/|assets\/)/.test(assetUrl)){
      setAssetError('No se reconoce el recurso local.');return;
    }
    const created=makeGraphicLayer('image',(selectedConfig.layers??[]).length);
    created.name=name.slice(0,60)||'Imagen';created.assetUrl=assetUrl;
    created.x=Math.max(0,Math.round((selectedConfig.geometry.width-created.width)/2));
    created.y=Math.max(0,Math.round((selectedConfig.geometry.height-created.height)/2));
    handleUpdate({layers:[...(selectedConfig.layers??[]),created]});selectIds([created.id]);openLayers();
  };
  const importImage=async(file?:File)=>{
    if(comparePublished)return;
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setAssetError('Solo se admiten PNG, JPG o WebP (máximo 15 MB).');return;}
    if(file.size>15*1024*1024){setAssetError('La imagen supera los 15 MB recomendados para emisión.');return;}
    const selectedDocumentKey=selectionKey;
    setAssetBusy(true);setAssetError('');
    try{
      const result=await LibraryService.upload(file);
      setStudioAssets(result.library.assets.filter(a=>a.type==='image'&&!a.isMissing));
      if(selectedDocumentKey===selectionKey)addAssetToCanvas(result.asset.url,result.asset.name);
      else setAssetError('Imagen guardada en Biblioteca. Selecciona el componente original para colocarla.');
    }catch(err){setAssetError(err instanceof Error?err.message:'No se pudo importar imagen');}
    finally{setAssetBusy(false);setAssetDrag(false);}
  };
  const centerObject=(axis:'x'|'y')=>{
    const custom=selectedConfig.layers?.find(layer=>layer.id===selectedLayerId);
    if(custom && !custom.locked){
      const size=axis==='x'?custom.width:custom.height;
      const extent=axis==='x'?selectedConfig.geometry.width:selectedConfig.geometry.height;
      handleUpdate({layers:selectedConfig.layers?.map(layer=>layer.id===selectedLayerId?{...layer,[axis]:Math.round((extent-size)/2)}:layer)});
    } else if(!selectedLayerId) {
      const extent=axis==='x'?1920:1080;
      const size=axis==='x'?selectedConfig.geometry.width:selectedConfig.geometry.height;
      handleGeometryChange(axis,Math.round(Math.max(0,(extent-size*selectedConfig.geometry.scale)/2)));
    }
  };
  const dragRef = useRef<null | {
    mode: 'move' | 'resize' | 'move-layer' | 'resize-layer' | 'rotate-layer';
    pointerX: number; pointerY: number; start: GeometrySettings;
    previewWidth: number; layerId?: string;
    layerStart?: GraphicLayer | LayerOverride;
    layerWidth?: number; layerHeight?: number;
    historyGroup:string; layerBounds?:Rect; peerBounds:Rect[];
    multiple?: string[]; originalConfig?:EditorialComponentConfig;
    resizeCorner?:'nw'|'ne'|'sw'|'se'; rotationAnchor?:{centerX:number;centerY:number;angle:number};
  }>(null);

  // Canvas is fitted by BOTH width and height. Zoom is a separate visual transform.
  // The world stays fixed at 1920×1080; stored OBS coordinates do not change.
  useEffect(() => {
    const element=workspaceRef.current;
    if (!element) return;
    const refresh=()=>{const r=element.getBoundingClientRect();setPreviewWidth(fitCanvasWidth(r.width,r.height));};
    refresh();
    const observer=new ResizeObserver(refresh);
    observer.observe(element);
    return ()=>observer.disconnect();
  }, [focusMode]);

  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;
      if(event.code==='Space'&&!event.repeat){holdingSpaceRef.current=true;setHoldingSpace(true);event.preventDefault();}
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.key.toLowerCase()==='v')setTool('select');
      if(event.key.toLowerCase()==='h')setTool('hand');
      if(event.key==='0')resetView();
      if(event.key==='+'||event.key==='=')zoomBy(25);
      if(event.key==='-')zoomBy(-25);
    };
    const keyup=(event:KeyboardEvent)=>{if(event.code==='Space'){holdingSpaceRef.current=false;setHoldingSpace(false);}};
    const onBlur=()=>{holdingSpaceRef.current=false;setHoldingSpace(false);panRef.current=null;setIsPanning(false);};
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',onBlur);
    return ()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',onBlur);};
  },[]);
  useEffect(()=>{
    const el=workspaceRef.current;
    if(!el)return;
    const onWheel=(event:WheelEvent)=>{
      if(!event.ctrlKey&&!event.metaKey)return;
      event.preventDefault();
      setZoom(current=>clampWorkspaceZoom(current+(event.deltaY>0?-10:10)));
    };
    el.addEventListener('wheel',onWheel,{passive:false});
    return ()=>el.removeEventListener('wheel',onWheel);
  },[focusMode]);
  const startPan=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.button!==1 && !(event.button===0&&(tool==='hand'||holdingSpaceRef.current)))return;
    event.preventDefault();event.stopPropagation();
    panRef.current={x:pan.x,y:pan.y,startX:event.clientX,startY:event.clientY,id:event.pointerId};
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan=(event:React.PointerEvent<HTMLDivElement>)=>{
    const p=panRef.current;
    if(!p||p.id!==event.pointerId)return;
    setPan({x:p.x+event.clientX-p.startX,y:p.y+event.clientY-p.startY});
  };
  const stopPan=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(panRef.current?.id!==event.pointerId)return;
    panRef.current=null;setIsPanning(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const beginTransform = (event: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize' | 'move-layer' | 'resize-layer' | 'rotate-layer', layerId?: string, resizeCorner:'nw'|'ne'|'sw'|'se'='se') => {
    if (event.button !== 0 || tool==='hand' || holdingSpaceRef.current || previewOnly) return;
    const builtIn = editableTemplateLayersFor(selectedConfig).some(x=>x.id===layerId);
    const layerData = builtIn ? selectedConfig.layerOverrides?.[layerId!] ?? {} : selectedConfig.layers?.find(x=>x.id===layerId);
    if (layerId && (layerData as any)?.locked) {selectOne(layerId);setActiveInspectorTab('smart');return;}
    const activeSelection=layerId ? (selectedIds.includes(layerId)?selectedIds:membersOfGroup(selectedConfig,layerId)) : [];
    if(layerId){selectIds(activeSelection);setActiveInspectorTab('smart');}
    event.preventDefault(); event.stopPropagation();

    const root=elementRef.current;
    const ratio=Math.max(.001,visualWidth/1920*selectedConfig.geometry.scale);
    const nodes=root?Array.from(root.querySelectorAll<HTMLElement>('[data-stdq-layer]')):[];
    const toRect=(node:HTMLElement):Rect=>{
      const r=node.getBoundingClientRect(),o=root!.getBoundingClientRect();
      return {x:(r.left-o.left)/ratio,y:(r.top-o.top)/ratio,width:r.width/ratio,height:r.height/ratio};
    };
    const active=nodes.find(node=>node.getAttribute('data-stdq-layer')===layerId);
    const peers=nodes.filter(node=>node!==active && node.getBoundingClientRect().width>0).map(toRect);
    dragRef.current = {
      mode, layerId, pointerX:event.clientX, pointerY:event.clientY,
      start:{...selectedConfig.geometry}, previewWidth: visualWidth,
      layerStart: layerData ? {...layerData} : {},
      layerWidth: layerRect ? layerRect.width * zoom / 100 : undefined,
      layerHeight: layerRect ? layerRect.height * zoom / 100 : undefined,
      historyGroup:`drag:${selectionKey}:${Date.now()}:${Math.random()}`,
      layerBounds: active?toRect(active):undefined, peerBounds:peers,
      multiple:mode==='move-layer'&&activeSelection.length>1?activeSelection:undefined, originalConfig:selectedConfig,
      resizeCorner, rotationAnchor:active?{centerX:active.getBoundingClientRect().left+active.getBoundingClientRect().width/2,
        centerY:active.getBoundingClientRect().top+active.getBoundingClientRect().height/2,
        angle:Math.atan2(event.clientY-(active.getBoundingClientRect().top+active.getBoundingClientRect().height/2),event.clientX-(active.getBoundingClientRect().left+active.getBoundingClientRect().width/2))*180/Math.PI}:undefined,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if(inlineEditor)return;
    const target = event.target as HTMLElement;
    const layerElement = target.closest('[data-stdq-layer]') as HTMLElement|null;
    const id = layerElement?.getAttribute('data-stdq-layer');
    if (id && (event.shiftKey||event.ctrlKey||event.metaKey)) {
      event.stopPropagation();event.preventDefault();selectOne(id,true);openLayers();return;
    }
    if (id) beginTransform(event, 'move-layer', id);
    else {selectIds([]);beginTransform(event,'move');}
  };

  const updateTransform = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    if (drag.mode === 'move' || drag.mode === 'resize') {
      const geometry = drag.mode === 'move'
        ? moveBox(drag.start,dx,dy,drag.previewWidth)
        : resizeBox(drag.start,dx,dy,drag.previewWidth);
      const position = drag.mode === 'move' && snapEnabled
        ? snapRect({x:geometry.x,y:geometry.y,width:geometry.width*geometry.scale,height:geometry.height*geometry.scale},[],{x:0,y:0,width:1920,height:1080},12)
        : null;
      setSnapGuides(position?.guides??[]);
      applyEdit({ geometry: {...selectedConfig.geometry,...geometry,...(position?{x:position.rect.x,y:position.rect.y}:{})} },drag.historyGroup);
      return;
    }
    if (!drag.layerId) return;
    if(drag.mode==='rotate-layer'&&drag.rotationAnchor){
      const anchor=drag.rotationAnchor;
      const angle=Math.atan2(event.clientY-anchor.centerY,event.clientX-anchor.centerX)*180/Math.PI;
      const value=rotateByPointer(Number(drag.layerStart?.rotation??0),anchor.angle,angle,event.shiftKey);
      const built=editableTemplateLayersFor(selectedConfig).some(x=>x.id===drag.layerId);
      if(built)applyEdit({layerOverrides:{...selectedConfig.layerOverrides,[drag.layerId]:{...selectedConfig.layerOverrides?.[drag.layerId],rotation:value}}},drag.historyGroup);
      else applyEdit({layers:(selectedConfig.layers??[]).map(l=>l.id===drag.layerId?{...l,rotation:value}:l)},drag.historyGroup);
      setSnapGuides([]);return;
    }
    if (drag.multiple && drag.originalConfig && drag.mode==='move-layer') {
      const factor=1920 / Math.max(1,drag.previewWidth) / Math.max(.1,drag.start.scale);
      // Use the original snapshot for every frame: no accumulating positional drift.
      const patch=moveSelection(drag.originalConfig,drag.multiple,dx*factor,dy*factor);
      applyEdit(patch,drag.historyGroup);setSnapGuides([]);return;
    }
    // Coordinates inside the component are scaled by both canvas zoom and component scale.
    const factor = 1920 / Math.max(1,drag.previewWidth) / Math.max(.1,drag.start.scale);
    const builtIn = editableTemplateLayersFor(selectedConfig).some(x=>x.id===drag.layerId);
    const startLayer = drag.layerStart || {};
    const baseWidth=(startLayer as GraphicLayer|LayerOverride).width??drag.layerBounds?.width??250;
    const baseHeight=(startLayer as GraphicLayer|LayerOverride).height??drag.layerBounds?.height??70;
    const corner=drag.resizeCorner??'se';
    const dxWorld=dx*factor,dyWorld=dy*factor;
    const nextLayer=drag.mode==='move-layer'
      ? moveGraphicLayer(startLayer,dxWorld,dyWorld)
      : {...startLayer,...resizeByCorner({x:startLayer.x??0,y:startLayer.y??0,width:baseWidth,height:baseHeight},dxWorld,dyWorld,corner)};
    if(drag.mode==='move-layer' && snapEnabled && drag.layerBounds) {
      const base=drag.layerBounds;
      const proposed={x:base.x+dx*factor,y:base.y+dy*factor,width:base.width,height:base.height};
      const snapped=snapRect(proposed,drag.peerBounds,
        {x:0,y:0,width:drag.start.width,height:drag.start.height},12);
      const target=nextLayer as {x?:number;y?:number};
      Object.assign(nextLayer,{x:Math.round((target.x??0)+(snapped.rect.x-proposed.x)),
        y:Math.round((target.y??0)+(snapped.rect.y-proposed.y))});
      setSnapGuides(snapped.guides.map(g=>({...g,value:g.axis==='x'
        ? drag.start.x+g.value*drag.start.scale : drag.start.y+g.value*drag.start.scale})));
    } else setSnapGuides([]);
    if (builtIn) applyEdit({layerOverrides:{...selectedConfig.layerOverrides,[drag.layerId]:nextLayer}},drag.historyGroup);
    else applyEdit({layers:(selectedConfig.layers||[]).map(x=>x.id===drag.layerId?{...x,...nextLayer}:x)},drag.historyGroup);
  };
  const stopTransform = () => {dragRef.current=null;setSnapGuides([]);};

  // Draw the selection around the actual element, not around an invented bounding box.
  useEffect(() => {
    const root=elementRef.current;
    if (!root || !selectedIds.length) {setLayerRect(null);setSelectionBoxes({});return;}
    const parent=root.getBoundingClientRect();
    const factor=zoom/100;
    const boxes:Record<string,{left:number;top:number;width:number;height:number}>={};
    root.querySelectorAll<HTMLElement>('[data-stdq-layer]').forEach(node=>{
      const id=node.dataset.stdqLayer;
      if(!id||!selectedIds.includes(id))return;
      const rect=node.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      boxes[id]={left:(rect.left-parent.left)/factor,top:(rect.top-parent.top)/factor,width:rect.width/factor,height:rect.height/factor};
    });
    setSelectionBoxes(boxes);
    setLayerRect(selectedLayerId&&boxes[selectedLayerId]?boxes[selectedLayerId]:null);
  },[selectedLayerId,selectedIds,selectedConfig,previewWidth,zoom]);

  // Direct text editing is an editor-only textarea; OBS keeps rendering the same layer.
  const [inlineEditor,setInlineEditor]=useState<{id:string;contentKey?:string;draft:string}|null>(null);
  const editorInputRef=useRef<HTMLTextAreaElement>(null);
  const inlineCancelRef=useRef(false);
  useEffect(()=>{if(inlineEditor)editorInputRef.current?.focus();},[inlineEditor?.id]);
  useEffect(()=>{setInlineEditor(null);},[selectedType,selectedCustomId]);
  const startInlineEdit=(id:string)=>{
    if(previewOnly)return;
    inlineCancelRef.current=false;
    const custom=selectedConfig.layers?.find(l=>l.id===id);
    if(custom){
      if(custom.kind!=='text'||custom.locked)return;
      selectIds([id]);setInlineEditor({id,draft:custom.text??''});return;
    }
    const original=editableTemplateLayersFor(selectedConfig).find(x=>x.id===id);
    const key=original?.contentKey;
    if(!key||selectedConfig.layerOverrides?.[id]?.locked||typeof selectedConfig.content[key]!=='string')return;
    selectIds([id]);setInlineEditor({id,contentKey:key,draft:selectedConfig.content[key]});
  };
  const finishInlineEdit=(commit:boolean)=>{
    const edit=inlineEditor;if(!edit)return;
    if(!commit)inlineCancelRef.current=true;
    setInlineEditor(null);
    if(!commit||inlineCancelRef.current)return;
    if(edit.contentKey){
      if(selectedConfig.content[edit.contentKey]!==edit.draft)
        handleUpdate({content:{...selectedConfig.content,[edit.contentKey]:edit.draft}});
    }else{
      const old=selectedConfig.layers?.find(l=>l.id===edit.id);
      if(old&&old.kind==='text'&&old.text!==edit.draft)
        handleUpdate({layers:(selectedConfig.layers??[]).map(l=>l.id===edit.id?{...l,text:edit.draft}:l)});
    }
  };
  const canvasDoubleClick=(event:React.MouseEvent<HTMLDivElement>)=>{
    const id=(event.target as HTMLElement).closest<HTMLElement>('[data-stdq-layer]')?.dataset.stdqLayer;
    if(!id)return;
    event.preventDefault();event.stopPropagation();startInlineEdit(id);
  };
  const updateBranding = (patch: Partial<NonNullable<EditorialComponentConfig['branding']>>) => {
    handleUpdate({ branding: { ...DefaultBranding, ...selectedConfig.branding, ...patch } });
  };

  const updateGlyph = (patch: Partial<NonNullable<EditorialComponentConfig['glyph']>>) => {
    handleUpdate({ glyph: {...DEFAULT_COMPONENT_GLYPH, ...selectedConfig.glyph, ...patch} });
  };
  const handleGlyphFile = async (file?: File) => {
    if (!file) return;
    setUploadError(''); setUploadingGlyph(true);
    try {
      const url = await uploadLogo(file);
      updateGlyph({ mode: 'image', assetUrl: url });
    } catch (err: any) { setUploadError(err.message || 'No se pudo cargar el icono'); }
    finally { setUploadingGlyph(false); }
  };

  const handleLogoFile = async (file?: File) => {
    if (!file) return;
    setUploadError('');
    setUploadingLogo(true);
    try {
      const assetUrl = await uploadLogo(file);
      updateBranding({ assetUrl, visible: true });
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo subir el logo');
    } finally { setUploadingLogo(false); }
  };


  const categories = [
    {
      name: 'Identificación & Conducción',
      types: ['lower-third', 'logo-bug', 'social-pill', 'social'] as ComponentType[]
    },
    {
      name: 'Titulación & Bloques',
      types: ['banner', 'chapter', 'section', 'ticker'] as ComponentType[]
    },
    {
      name: 'Editorial & Citas',
      types: ['quote', 'scripture', 'editorial', 'question'] as ComponentType[]
    },
    {
      name: 'Pantallas de Emisión',
      types: ['waiting', 'break', 'outro'] as ComponentType[]
    }
  ];

  const handleUpdate = (updated: Partial<EditorialComponentConfig>) => applyEdit(updated,`property:${Object.keys(updated).sort().join(',')}`);
  const addCanvasLayer=(kind:GraphicLayer['kind'])=>{
    if(comparePublished)return;
    const created=makeGraphicLayer(kind,(selectedConfig.layers??[]).length);
    handleUpdate({layers:[...(selectedConfig.layers??[]),created]});
    selectIds([created.id]);openLayers();
  };

  // Keyboard actions only apply when focus is outside editable controls.
  useEffect(() => {
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(commandOpen || comparePublished || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable||event.altKey)return;
      const command=event.ctrlKey||event.metaKey;
      if(command&&event.key.toLowerCase()==='a'){
        event.preventDefault();selectIds(layerIds(selectedConfig).filter(id=>!isLocked(selectedConfig,id)));openLayers();return;
      }
      if(command&&event.key.toLowerCase()==='g'){
        event.preventDefault();if(event.shiftKey)ungroupSelected();else groupSelected();return;
      }
      if(command&&event.key.toLowerCase()==='d'){
        event.preventDefault();duplicateSelected();return;
      }
      if(event.key==='Escape'){selectIds([]);return;}
      if(!selectedIds.length||command)return;
      if((event.key==='Delete'||event.key==='Backspace')&&selectedIds.length){
        event.preventDefault();const ids=new Set(selectedIds);
        const next=(selectedConfig.layers??[]).filter(layer=>!ids.has(layer.id)||layer.locked);
        if(next.length!==(selectedConfig.layers??[]).length){handleUpdate({layers:next});selectIds(selectedIds.filter(id=>!selectedConfig.layers?.some(l=>l.id===id&&!l.locked)));}
        return;
      }
      const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const direction=directions[event.key];if(!direction)return;
      event.preventDefault();const delta=event.shiftKey?10:1;
      handleUpdate(moveSelection(selectedConfig,selectedIds,direction[0]*delta,direction[1]*delta));
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[selectedConfig,selectedIds,commandOpen,comparePublished]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(commandOpen || comparePublished || !(event.ctrlKey||event.metaKey)||event.altKey)return;
      if(event.key.toLowerCase()!=='z' && event.key.toLowerCase()!=='y')return;
      const target=event.target as HTMLElement;
      if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;
      event.preventDefault();
      stepEdit(event.key.toLowerCase()==='y'||event.shiftKey?1:-1);
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[selectedType,historyVersion,commandOpen,comparePublished]);

  const handleContentChange = (key: string, value: any) => {
    handleUpdate({
      content: {
        ...selectedConfig.content,
        [key]: value
      }
    });
  };

  const handleFontChange = (key: keyof FontSettings, value: any) => {
    handleUpdate({
      font: {
        ...selectedConfig.font,
        [key]: value
      }
    });
  };

  const handleGeometryChange = (key: keyof GeometrySettings, value: any) => {
    handleUpdate({
      geometry: {
        ...selectedConfig.geometry,
        [key]: value
      }
    });
  };

  const handleAnimationChange = (key: keyof AnimationSettings, value: any) => {
    handleUpdate({
      animation: {
        ...selectedConfig.animation,
        [key]: value
      }
    });
    playPreview(false);
  };

  const overlayUrl = `${window.location.origin}${selectedCustomId?customOverlayPath(selectedCustomId):`/?overlay=${selectedType}`}`;

  const copyOverlayUrl = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="stdq-studio-shell flex-1 flex overflow-hidden w-full h-[calc(100vh-4rem)] select-none">
      <StudioCommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} commands={commands}/>

      {/* ======================================================== */}
      {/* 1. LEFT PANEL: COMPONENT LIBRARY & LAYERS                */}
      {/* ======================================================== */}
      {!focusMode && <aside aria-label="Biblioteca de componentes y capas" style={{width:panelWidths.left}} className="glass-panel border-r border-white/10 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Studio / Assets
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">15 plantillas + {Object.keys(customComponents).length} gráficas independientes</p>
          <button type="button" className="w-full rounded-lg mt-3 bg-[#FF6B00]/15 border border-[#FF6B00]/50 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-[#FF6B00]/25" onClick={()=>setCreateOpen(v=>!v)}>
            + Nueva gráfica independiente
          </button>
          {createOpen && <form onSubmit={submitNewGraphic} className="mt-3 space-y-2 rounded-xl bg-black/35 p-3 border border-white/10">
            <label className="block text-[11px] text-slate-300">Nombre de la gráfica</label>
            <input autoFocus required maxLength={72} className="w-full bg-slate-900 border border-white/15 rounded-lg p-2 text-xs" value={newGraphicName} onChange={e=>setNewGraphicName(e.target.value)} placeholder="Banner — Invitado especial"/>
            <label className="block text-[11px] text-slate-300">Partir de una plantilla editable</label>
            <select className="w-full bg-slate-900 border border-white/15 rounded-lg p-2 text-xs" value={newGraphicTemplate} onChange={e=>setNewGraphicTemplate(e.target.value as ComponentType|'blank')}>
              <option value="blank">Lienzo vacío — empezar desde cero</option>
              {Object.values(components).map(item=><option key={item.type} value={item.type}>{item.name}</option>)}
            </select>
            <button type="submit" className="w-full rounded-lg bg-[#FF6B00] text-white p-2 text-xs font-bold">Crear y editar</button>
          </form>}
          <label className="flex gap-2 items-center rounded-xl border border-white/10 bg-black/25 px-3 py-2 mt-3 text-slate-500 focus-within:border-[#FF6B00]/60">
            <Search size={14}/><input value={componentSearch} onChange={e=>setComponentSearch(e.target.value)} placeholder="Buscar componente..." aria-label="Buscar componente" className="bg-transparent text-xs text-white placeholder:text-slate-600 flex-1 min-w-0 outline-none"/>
            {componentSearch&&<button aria-label="Limpiar búsqueda" onClick={()=>setComponentSearch('')} className="text-slate-400">×</button>}
          </label>
        </div>

        <div className="p-3 space-y-4 flex-1 min-h-0 overflow-y-auto">
          <section className="space-y-2" aria-label="Gráficas independientes">
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-300 px-2">Mis gráficas ({Object.keys(customComponents).length})</div>
            {Object.values(customComponents).filter(g=>g.name.toLowerCase().includes(componentSearch.toLowerCase())).map(g=><div key={g.instanceId} className={`flex items-center rounded-xl border ${selectedCustomId===g.instanceId?'border-orange-400/60 bg-orange-400/10':'border-white/10 bg-white/[0.02]'}`}>
              <button className="p-2.5 text-left text-xs text-white min-w-0 flex-1 truncate" onClick={()=>selectCustom(g.instanceId!)} title={g.name}>{g.name}{g.visibleInOBS?' ●':''}</button>
              <button type="button" disabled={Boolean(publishedCustomComponents[g.instanceId!])} className="p-2 text-xs text-slate-400 hover:text-rose-300 disabled:opacity-25" title={publishedCustomComponents[g.instanceId!]?'Gráfica publicada: conserva su fuente OBS. Por seguridad no se elimina desde borradores.':'Eliminar borrador sin publicar'} onClick={()=>{if(window.confirm(`¿Eliminar «${g.name}»? Su fuente OBS dejará de funcionar. Esta acción no tiene deshacer.`)){onRemoveCustom(g.instanceId!);if(selectedCustomId===g.instanceId)setSelectedCustomId(null);}}}>×</button>
            </div>)}
            {!Object.keys(customComponents).length&&<p className="text-[11px] text-slate-500 px-2">Crea una gráfica con su propia dirección OBS, sin reemplazar las plantillas.</p>}
          </section>
          {categories.map((cat, idx) => ({...cat,types:cat.types.filter(type=>components[type].name.toLocaleLowerCase('es').includes(componentSearch.toLocaleLowerCase('es')) || type.includes(componentSearch.toLowerCase()))})).filter(cat=>cat.types.length).map((cat, idx) => (
            <div key={idx} className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block">
                {cat.name}
              </span>
              <div className="space-y-1">
                {cat.types.map((type) => {
                  const comp = components[type];
                  const isSelected = selectedType === type && !selectedCustomId;
                  const isLive = comp?.visibleInOBS;

                  return (
                    <button
                      key={type}
                      onClick={() => selectTemplate(type)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#FF6B00]/15 text-white border border-[#FF6B00]/40 shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      <span className="truncate">{comp.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLive && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Al aire en OBS" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {assetDrawer && <section className="border-t border-white/10 px-3 py-3 max-h-[35vh] overflow-y-auto" aria-label="Recursos gráficos de Biblioteca">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-[10px] uppercase text-slate-300 tracking-widest">Imágenes de Biblioteca</strong>
            <button onClick={()=>void refreshStudioAssets()} disabled={assetLibraryLoading} className="text-[10px] text-orange-300 hover:text-white">Actualizar</button>
          </div>
          {assetLibraryLoading && <p className="text-[11px] text-slate-400">Cargando recursos…</p>}
          {!assetLibraryLoading && !studioAssets.length && <p className="text-[11px] text-slate-400">No hay imágenes todavía. Usa «Imagen» o arrastra un archivo PNG/JPG/WebP al lienzo.</p>}
          <div className="grid grid-cols-2 gap-2">
            {studioAssets.map(asset=><button key={asset.id} draggable title={`Agregar ${asset.name} al lienzo`}
              onDragStart={e=>e.dataTransfer.setData('application/x-stdq-media',asset.id)}
              onClick={()=>addAssetToCanvas(asset.url,asset.name)}
              className="rounded-lg border border-white/10 bg-black/30 p-1.5 hover:border-orange-400/60 flex flex-col gap-1 text-left overflow-hidden">
              <img src={asset.thumbnailUrl||asset.url} alt="" loading="lazy" className="w-full h-16 object-contain rounded bg-[#101116]"/>
              <span className="text-[10px] text-slate-300 truncate w-full">{asset.name}</span>
            </button>)}
          </div>
        </section>}
        <WorkspaceLayerTree config={selectedConfig} selectedId={selectedLayerId} selectedIds={selectedIds} onSelect={selectOne}
          onUpdate={handleUpdate} onOpenInspector={openLayers} onAddLayer={addCanvasLayer} />
      </aside>}
      {!focusMode && <div role="separator" aria-orientation="vertical" aria-label="Ajustar ancho biblioteca" title="Arrastra para cambiar el ancho de Biblioteca" className="studio-panel-divider"
        onPointerDown={e=>beginPanelDrag(e,'left')} onPointerMove={movePanelDrag} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}/>}

      {/* ======================================================== */}
      {/* 2. CENTER PANEL: 16:9 HIGH-DPI CANVAS & CONTROLS         */}
      {/* ======================================================== */}
      <main aria-label="Lienzo de diseño y previsualización" className="flex-1 flex flex-col overflow-hidden bg-[#07080A]">
        {/* Canvas Toolbar */}
        <div className="studio-topbar shrink-0" aria-label="Estado y publicación del estudio">
          <div className="studio-topbar-primary">
            <div className="flex items-center gap-3 min-w-0">
              <div className="studio-app-mark"><Sparkles size={15}/></div>
              <div className="min-w-0"><div className="studio-eyebrow">CONTENT STUDIO <span className="mx-1.5 opacity-40">/</span> V4.2</div>
                <div className="text-sm font-semibold text-white truncate" title={selectedConfig.name}>{selectedConfig.name}</div></div>
              {selectedCustomId && <button type="button" className="studio-subtle-action" onClick={()=>{
                const name=window.prompt('Nombre de esta gráfica independiente',selectedConfig.name);
                if(name?.trim())handleUpdate({name:name.trim().slice(0,72)});
              }}>Renombrar</button>}
              <span className="hidden 2xl:inline studio-resolution-label">1920 × 1080</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div role="status" aria-live="polite" className={`studio-save-pill studio-save-${saveStatus}`}>
                <span className="studio-status-dot"/>
                <span>{saveStatus==='saved'?'Borrador guardado':saveStatus==='saving'?'Guardando borrador…':'Error de guardado'}</span>
                {saveStatus==='error'&&<button type="button" onClick={onRetrySave} className="underline ml-1">Reintentar</button>}
              </div>
              <button type="button" className="studio-command-button" onClick={()=>setCommandOpen(true)} title="Acciones del editor (Ctrl+K)">
                <Command size={14}/> Acciones <kbd>Ctrl K</kbd>
              </button>
            </div>
          </div>
          <div className="studio-topbar-publish">
            <div className="flex items-center gap-2 min-w-0">
              <span className="studio-stage-label">CONTROL DE VERSIONES</span>
              <span className={`studio-version-pill ${publishedSelected?.visibleInOBS?'studio-version-live':''}`}>{publishedSelected?.visibleInOBS?'● AL AIRE':publishedSelected?'● Publicada':'Nunca publicada'}</span>
              <span className={`studio-change-pill ${draftDifferent?'studio-change-pending':'studio-change-synced'}`}>{draftDifferent?'● Cambios pendientes':'✓ Sin cambios'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="studio-view-toggle" role="group" aria-label="Comparación de diseños">
                <button type="button" aria-pressed={!comparePublished} onClick={()=>{setComparePublished(false);setPreviewOnly(false);}} className={!comparePublished?'active':''}>Borrador</button>
                <button type="button" disabled={!publishedSelected} aria-pressed={comparePublished}
                  onClick={()=>{setComparePublished(true);setPreviewOnly(true);selectIds([]);}} className={comparePublished?'active':''}>Publicado</button>
              </div>
              <select aria-label="Versiones anteriores" value={historySelection} onChange={event=>setHistorySelection(event.target.value===''?'':Number(event.target.value))}
                className="studio-history-select"><option value="">Historial…</option>
                {(timeline?.revisions??[]).slice().reverse().map(r=><option key={r.version} value={r.version}>v{r.version} · {r.pinned?'🔒 ':''}{r.label||`Guardada ${r.publishedAt.slice(0,10)}`}</option>)}</select>
              <button type="button" disabled={publicationBusy||saveStatus!=='saved'} className="studio-secondary-cta" onClick={()=>void manageHistory('save')}>+ Guardar versión</button>
              <button type="button" disabled={publicationBusy||historySelection===''} className="studio-secondary-cta" onClick={()=>void manageHistory('restore-draft')}>Recuperar borrador</button>
              <button type="button" disabled={publicationBusy||historySelection===''} className="studio-history-more" onClick={()=>setHistoryActionsOpen(v=>!v)} aria-expanded={historyActionsOpen}>Gestionar</button>
              <button type="button" disabled={publicationBusy||saveStatus==='saving'||saveStatus==='error'||!draftDifferent||Boolean(publishedSelected?.visibleInOBS)}
                title={publishedSelected?.visibleInOBS?'Retira primero la fuente del aire':saveStatus==='error'?'Soluciona primero el guardado del borrador':'Publicación explícita, con confirmación'}
                className="studio-publish-cta" onClick={()=>void publishSelected()}><ShieldCheck size={14}/> {publicationBusy?'Publicando…':'Publicar'}</button>
            </div>
          </div>
          {historyActionsOpen && <div className="studio-history-management" role="group" aria-label="Gestionar historial">
            <span>Solo «Guardar versión» genera revisiones. Publicar y recuperar no crean copias.</span>
            <button type="button" disabled={publicationBusy||historySelection===''} onClick={()=>void manageHistory('rename')}>Renombrar</button>
            <button type="button" disabled={publicationBusy||historySelection===''} onClick={()=>void manageHistory('pin')}>{timeline?.revisions.find(r=>r.version===historySelection)?.pinned?'Desproteger':'Proteger'}</button>
            <button type="button" disabled={publicationBusy||historySelection===''||Boolean(timeline?.revisions.find(r=>r.version===historySelection)?.pinned)} onClick={()=>void manageHistory('remove')}>Eliminar</button>
          </div>}
          {publicationMessage&&<p role="alert" className="px-5 py-1.5 text-[11px] text-rose-300 bg-rose-500/10">{publicationMessage}</p>}
          {publishedSelected?.visibleInOBS&&<div role="status" className="studio-air-notice"><Radio size={13}/> EN VIVO: puedes editar tu borrador. Publicar y restaurar requieren retirar la gráfica del aire.</div>}
        </div>
        <div className="studio-view-controls shrink-0">
          {/* Viewport & Guide Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSafeZones(!showSafeZones)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                showSafeZones
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
              title="Zonas seguras de televisión (Action 90% / Title 80%)"
            >
              Safe Zones
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 text-xs rounded-lg font-medium border transition-colors ${
                showGrid
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
              title="Cuadrícula guía de 120 píxeles de diseño"
              aria-label="Alternar cuadrícula guía"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            {/* Canvas Background selector */}
            <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 text-xs">
              <button
                onClick={() => setCanvasBg('dark')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${canvasBg === 'dark' ? 'bg-white/15 text-white' : 'text-slate-400'}`}
              >
                Estudio
              </button>
              <button
                onClick={() => setCanvasBg('camera')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${canvasBg === 'camera' ? 'bg-white/15 text-white' : 'text-slate-400'}`}
              >
                Simulación
              </button>
              <button
                onClick={() => setCanvasBg('transparent')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${canvasBg === 'transparent' ? 'bg-white/15 text-white' : 'text-slate-400'}`}
              >
                OBS Alpha
              </button>
            </div>

            <div className="h-4 w-px bg-white/10 mx-1" />

            {/* OBS Broadcast Action */}
            <button
              disabled={!publishedSelected}
              title={!publishedSelected?'Publica primero esta gráfica antes de enviarla a OBS':'Control real de visibilidad OBS'}
              onClick={() => onToggleVisibility(selectionKey)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                publishedSelected?.visibleInOBS
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-[#FF6B00] text-white hover:bg-[#ff7a1a] shadow-md shadow-[#FF6B00]/20'
              }`}
            >
              {publishedSelected?.visibleInOBS ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Retirar de OBS</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Enviar al Aire</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="min-h-11 px-4 py-1 shrink-0 border-b border-white/10 flex items-center justify-between gap-2 bg-[#0d0e13] flex-wrap">
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <button onClick={()=>setTool('select')} aria-pressed={tool==='select'} title="Seleccionar (V)" className={`studio-tool ${tool==='select'?'studio-tool-active':''}`}><MousePointer2 size={15}/> Seleccionar <kbd className="text-[9px] opacity-50">V</kbd></button>
            <button onClick={()=>setTool('hand')} aria-pressed={tool==='hand'} title="Mover vista (H) · Espacio + arrastrar" className={`studio-tool ${tool==='hand'?'studio-tool-active':''}`}><Hand size={15}/> Mano <kbd className="text-[9px] opacity-50">H</kbd></button>
            <span className="h-5 w-px bg-white/10 mx-1"/>
            <button className="studio-tool" onClick={()=>centerObject('x')} title="Centrar en horizontal" disabled={Boolean(selectedLayerId && !selectedConfig.layers?.some(x=>x.id===selectedLayerId))}><AlignHorizontalJustifyCenter size={15}/></button>
            <button className="studio-tool" onClick={()=>centerObject('y')} title="Centrar en vertical" disabled={Boolean(selectedLayerId && !selectedConfig.layers?.some(x=>x.id===selectedLayerId))}><AlignVerticalJustifyCenter size={15}/></button>
          </div>
          <div className="flex gap-1 items-center shrink-0">
            <button onClick={toggleAssetDrawer} aria-pressed={assetDrawer} className={`studio-tool ${assetDrawer?'studio-tool-active':''}`} title="Abrir imágenes de Biblioteca"><Layers size={14}/> Recursos</button>
            <label title="Importar imagen a Biblioteca y composición" className={`studio-tool cursor-pointer ${assetBusy||comparePublished?'opacity-40 pointer-events-none':''}`}>
              <ImagePlus size={14}/> Imagen
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={assetBusy||comparePublished} onChange={e=>{void importImage(e.target.files?.[0]);e.currentTarget.value='';}}/>
            </label>
            <span className="text-[10px] text-slate-500 hidden 2xl:inline">Arrastra recursos al lienzo</span>
          </div>
          <div className="flex gap-1 items-center border-l border-white/10 pl-2" aria-label="Historial del componente">
            <button disabled={!flags.canUndo} onClick={()=>stepEdit(-1)} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"
              className="p-1.5 rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-30"><Undo2 size={16}/></button>
            <button disabled={!flags.canRedo} onClick={()=>stepEdit(1)} title="Rehacer (Ctrl+Y / Ctrl+Shift+Z)" aria-label="Rehacer"
              className="p-1.5 rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-30"><Redo2 size={16}/></button>
            <button onClick={()=>setSnapEnabled(v=>!v)} title="Imán: ajuste inteligente al mover" aria-pressed={snapEnabled}
              className={`p-1.5 rounded-lg ${snapEnabled?'text-[#FF6B00] bg-[#FF6B00]/15':'text-slate-500 hover:bg-white/10'}`}><Magnet size={16}/></button>
            <button onClick={()=>playPreview(true)} title="Reproducir entrada, permanencia y salida (sin emitir en OBS)"
              className="p-1.5 rounded-lg text-slate-200 hover:bg-white/10 flex gap-1 items-center"><PlayCircle size={16}/><span className="text-[10px]">Motion</span></button>
            <span className="h-5 w-px bg-white/10 mx-1"/>
            <button onClick={()=>setShowRulers(v=>!v)} title="Reglas en píxeles" aria-pressed={showRulers} className={`studio-tool ${showRulers?'studio-tool-active':''}`}><Ruler size={14}/></button>
            <button onClick={()=>{if(!comparePublished)setPreviewOnly(v=>!v);}} disabled={comparePublished} title="Vista limpia: ocultar controles de edición" aria-pressed={previewOnly} className={`studio-tool ${previewOnly?'studio-tool-active':''}`}><MonitorPlay size={14}/></button>
            <button onClick={()=>setFocusMode(v=>!v)} title="Ampliar lienzo (ocultar paneles)" aria-pressed={focusMode} className={`studio-tool ${focusMode?'studio-tool-active':''}`}><Focus size={14}/></button>
            <span className="h-5 w-px bg-white/10 mx-1"/>
            <button onClick={()=>zoomBy(-25)} className="studio-tool" title="Reducir zoom (-)"><Minus size={14}/></button>
            <span className="text-[11px] min-w-11 text-center font-mono text-white">{zoom}%</span>
            <button onClick={()=>zoomBy(25)} className="studio-tool" title="Aumentar zoom (+)"><Plus size={14}/></button>
            <button onClick={resetView} className="studio-tool" title="Ajustar lienzo y centrar (0)"><Scan size={14}/> Ajustar</button>
          </div>
        </div>

        {selectedIds.length>0 && !previewOnly && <div className="studio-selection-toolbar" aria-label="Operaciones de selección">
          <span className="text-[10px] font-mono text-orange-300 shrink-0">{selectedIds.length} {selectedIds.length===1?'CAPA':'CAPAS'}</span>
          <span className="h-4 w-px bg-white/10"/>
          <button disabled={selectedIds.length<2} onClick={groupSelected} title="Agrupar selección (Ctrl+G)" className="studio-tool"><Group size={14}/> Agrupar</button>
          <button onClick={ungroupSelected} title="Desagrupar selección (Ctrl+Mayús+G)" className="studio-tool"><Ungroup size={14}/></button>
          <button disabled={!selectedIds.some(id=>selectedConfig.layers?.some(l=>l.id===id))} onClick={duplicateSelected} title="Duplicar capas propias (Ctrl+D)" className="studio-tool"><CopyPlus size={14}/> Duplicar</button>
          <span className="h-4 w-px bg-white/10"/>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('left')} title="Alinear a izquierda" className="studio-tool"><AlignStartVertical size={14}/></button>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('center-x')} title="Alinear centros horizontales" className="studio-tool"><AlignHorizontalJustifyCenter size={14}/></button>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('right')} title="Alinear a derecha" className="studio-tool"><AlignEndVertical size={14}/></button>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('top')} title="Alinear arriba" className="studio-tool"><AlignStartHorizontal size={14}/></button>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('center-y')} title="Alinear centros verticales" className="studio-tool"><AlignVerticalJustifyCenter size={14}/></button>
          <button disabled={selectedIds.length<2} onClick={()=>alignSelected('bottom')} title="Alinear abajo" className="studio-tool"><AlignEndHorizontal size={14}/></button>
          <span className="h-4 w-px bg-white/10"/>
          <button disabled={selectedIds.length<3} onClick={()=>distributeSelected('x')} title="Distribuir equitativamente en horizontal" className="studio-tool"><Columns3 size={14}/></button>
          <button disabled={selectedIds.length<3} onClick={()=>distributeSelected('y')} title="Distribuir equitativamente en vertical" className="studio-tool"><Rows3 size={14}/></button>
          <button onClick={()=>selectIds([])} title="Limpiar selección (Escape)" className="studio-tool">×</button>
        </div>}
        {assetError && <div role="alert" className="px-5 py-2 text-xs text-rose-300 border-b border-rose-500/20">{assetError} <button onClick={()=>setAssetError('')} className="ml-2 underline">Cerrar</button></div>}

        {/* Scaled 16:9 Canvas Viewport */}
        <div ref={workspaceRef} className={`flex-1 min-h-0 overflow-hidden relative select-none ${isPanning||tool==='hand'||holdingSpace?'cursor-grabbing':'cursor-default'}`}
          onPointerDownCapture={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}
          onContextMenu={e=>{if(tool==='hand'||isPanning)e.preventDefault();}}
          onDragOver={e=>{if(comparePublished)return;if(e.dataTransfer.types.includes('Files')||e.dataTransfer.types.includes('application/x-stdq-media')){e.preventDefault();e.dataTransfer.dropEffect='copy';setAssetDrag(true);}}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setAssetDrag(false);}}
          onDrop={e=>{e.preventDefault();setAssetDrag(false);if(comparePublished)return;const id=e.dataTransfer.getData('application/x-stdq-media');const asset=studioAssets.find(a=>a.id===id);if(asset)addAssetToCanvas(asset.url,asset.name);else void importImage(Array.from(e.dataTransfer.files).find(file=>file.type.startsWith('image/')));}}>
          {assetDrag&&<div className="absolute inset-4 z-50 rounded-2xl pointer-events-none bg-orange-500/10 border-2 border-dashed border-orange-400 flex justify-center items-center text-white font-semibold tracking-wider">SUELTA LA IMAGEN PARA IMPORTARLA</div>}
          <div className="absolute left-4 top-4 z-40 pointer-events-none flex gap-2 text-[10px] font-bold tracking-wider text-slate-400">
            <span className="rounded-lg bg-black/60 px-2.5 py-1.5 border border-white/10">{comparePublished?'VISTA PUBLICADA · SOLO LECTURA':'BORRADOR · PREVIEW SEGURA'}</span>
            <span className="rounded-lg bg-black/60 px-2.5 py-1.5 border border-white/10">{zoom}% · {selectedConfig.name}</span>
          </div>
          <div ref={viewportRef}
            style={{width:previewWidth, left:'50%',top:'50%',transform:`translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom/100})`,transformOrigin:'center center'}}
            className={`absolute aspect-video rounded-xl shadow-[0_18px_90px_rgba(0,0,0,.65)] border border-white/15 overflow-hidden ${
              canvasBg === 'dark'
                ? 'bg-[#0B0D12] monitor-grid'
                : canvasBg === 'camera'
                ? 'bg-gradient-to-tr from-slate-900 via-indigo-950/60 to-slate-900'
                : 'studio-checkerboard'
            }`}
          >
            {/* Grid Overlay if enabled */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" style={{backgroundSize:`${120*previewWidth/1920}px ${120*previewWidth/1920}px`}} />
            )}
            {showRulers && !previewOnly && <div className="pointer-events-none absolute inset-0 z-10 text-slate-300 font-mono text-[9px]">
              <div className="absolute left-0 right-0 top-0 h-5 bg-black/50 border-b border-white/10">
                <div className="absolute inset-0 opacity-40" style={{backgroundSize:`${240*previewWidth/1920}px 100%`,backgroundImage:'repeating-linear-gradient(90deg,rgba(255,255,255,.6) 0 1px,transparent 1px 8px)'}} />
                {[0,480,960,1440,1920].map(x=><span key={x} className="absolute top-0.5" style={{left:`${x/1920*100}%`}}>{x}</span>)}
              </div>
              <div className="absolute left-0 top-5 bottom-0 w-5 bg-black/50 border-r border-white/10">
                {[270,540,810,1080].map(y=><span key={y} className="absolute left-0.5" style={{top:`${y/1080*100}%`,writingMode:'vertical-rl'}}>{y}</span>)}
              </div>
            </div>}

            {/* Broadcast Safe Zones Guide */}
            {showSafeZones && !previewOnly && (
              <>
                {/* Action Safe (90%) */}
                <div 
                  className="absolute border border-sky-400/30 pointer-events-none rounded"
                  style={{
                    left: `${(BROADCAST_SAFE_ZONES.ACTION_SAFE.x / 1920) * 100}%`,
                    top: `${(BROADCAST_SAFE_ZONES.ACTION_SAFE.y / 1080) * 100}%`,
                    width: `${(BROADCAST_SAFE_ZONES.ACTION_SAFE.width / 1920) * 100}%`,
                    height: `${(BROADCAST_SAFE_ZONES.ACTION_SAFE.height / 1080) * 100}%`,
                  }}
                >
                  <span className="text-[9px] font-mono text-sky-400/60 absolute top-1 left-1">
                    ACTION SAFE 90%
                  </span>
                </div>

                {/* Title Safe (80%) */}
                <div 
                  className="absolute border border-emerald-400/30 pointer-events-none rounded"
                  style={{
                    left: `${(BROADCAST_SAFE_ZONES.TITLE_SAFE.x / 1920) * 100}%`,
                    top: `${(BROADCAST_SAFE_ZONES.TITLE_SAFE.y / 1080) * 100}%`,
                    width: `${(BROADCAST_SAFE_ZONES.TITLE_SAFE.width / 1920) * 100}%`,
                    height: `${(BROADCAST_SAFE_ZONES.TITLE_SAFE.height / 1080) * 100}%`,
                  }}
                >
                  <span className="text-[9px] font-mono text-emerald-400/60 absolute top-1 left-1">
                    TITLE SAFE 80%
                  </span>
                </div>
              </>
            )}

            {!previewOnly && snapGuides.map((guide,index)=><div key={`${guide.axis}-${index}`} className="absolute z-30 pointer-events-none bg-[#FF6B00]/80"
              style={guide.axis==='x'?{left:`${guide.value/1920*100}%`,top:0,bottom:0,width:1}:
                {top:`${guide.value/1080*100}%`,left:0,right:0,height:1}} />)}
            {/* Editor works in 1920×1080 world pixels, rendered at responsive zoom. */}
            <div
              className={`absolute z-20 touch-none ${tool==='hand'||holdingSpace?'cursor-grab':'cursor-move active:cursor-grabbing'}`}
              style={{
                left: canvasConfig.geometry.x * previewWidth / 1920,
                top: canvasConfig.geometry.y * previewWidth / 1920,
                width: canvasConfig.geometry.width * canvasConfig.geometry.scale * previewWidth / 1920,
                height: canvasConfig.geometry.height * canvasConfig.geometry.scale * previewWidth / 1920,
              }}
              onDoubleClick={previewOnly||comparePublished?undefined:canvasDoubleClick}
              onPointerDown={previewOnly||comparePublished?undefined:handleCanvasPointerDown}
              onPointerMove={previewOnly||comparePublished?undefined:updateTransform}
              onPointerUp={stopTransform}
              onPointerCancel={stopTransform}
              title="Arrastrar el componente para moverlo"
            >
              <AnimatePresence initial={false}>
              {previewPhase==='show' && (
                <Motion.div
                  key={motionReplayKey(selectedType,timelineReplay)}
                  ref={elementRef}
                  className="absolute origin-top-left"
                  initial={previewMotion.initial}
                  animate={previewMotion.animate}
                  exit={previewMotion.exit}
                  transition={previewMotion.transition}
                  style={{
                    width: canvasConfig.geometry.width,
                    height: canvasConfig.geometry.height,
                    transformOrigin: 'top left',
                    // The outer movable container owns X/Y. This element owns the effect.
                  }}
                >
                  <div style={{
                    width: canvasConfig.geometry.width, height: canvasConfig.geometry.height,
                    transform: `scale(${previewWidth / 1920 * canvasConfig.geometry.scale}) rotate(${canvasConfig.geometry.rotation}deg)`,
                    transformOrigin: 'top left',
                  }}>
                    <div className="relative" style={{ width: canvasConfig.geometry.width, height: canvasConfig.geometry.height }}>
                      <GraphicComponentRenderer config={canvasConfig} isCanvasPreview={true} selectedLayerId={previewOnly||selectedIds.length>1?null:selectedLayerId} />
                      {!Array.isArray(selectedConfig.layerOrder) && <BrandLogoLayer config={canvasConfig}/>}
                    </div>
                  </div>
                </Motion.div>
              )}
              </AnimatePresence>
              {!previewOnly&&inlineEditor&&layerRect&&<div className="absolute z-[60] pointer-events-auto"
                style={{left:Math.max(0,layerRect.left),top:Math.max(0,layerRect.top),width:Math.max(190,layerRect.width),minHeight:Math.max(55,layerRect.height)}}
                onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
                <textarea ref={editorInputRef} autoFocus value={inlineEditor.draft} aria-label="Editar texto directamente sobre el lienzo"
                  onChange={e=>setInlineEditor(prev=>prev?{...prev,draft:e.target.value}:null)}
                  onBlur={()=>{if(!inlineCancelRef.current)finishInlineEdit(true);}}
                  onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finishInlineEdit(false);}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishInlineEdit(true);}}}
                  className="w-full min-h-16 p-2 rounded border-2 border-orange-400 bg-[#090A0F]/95 text-white text-sm shadow-2xl outline-none resize-y"
                  style={{height:Math.max(66,layerRect.height)}}/>
                <div className="text-[9px] bg-black/90 text-orange-200 px-2 py-1 rounded-b">Ctrl+Enter guardar · Esc cancelar · Clic fuera guardar</div>
              </div>}
              {!previewOnly && selectedIds.length>1 && Object.entries(selectionBoxes).map(([id,b])=><div key={id}
                className="absolute pointer-events-none z-30 border border-sky-300/80 bg-sky-300/5 rounded-sm"
                style={{left:b.left,top:b.top,width:b.width,height:b.height}}>
                <span className="absolute -top-4 left-0 text-[8px] text-sky-200 bg-slate-950/90 rounded-sm px-1">{id}</span>
              </div>)}
              {!previewOnly && selectedIds.length===1 && selectedLayerId && layerRect && <div className="absolute z-30 pointer-events-none border-2 border-sky-300 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
                style={{left:layerRect.left,top:layerRect.top,width:layerRect.width,height:layerRect.height}}>
                <span className="absolute -top-5 left-0 whitespace-nowrap px-1 py-0.5 text-[9px] text-white bg-sky-700 rounded">Capa: {selectedLayerId}</span>
                {(()=>{
                  const layer=selectedConfig.layers?.find(l=>l.id===selectedLayerId);
                  const builtin=editableTemplateLayersFor(selectedConfig).find(l=>l.id===selectedLayerId);
                  const editable=(layer?.kind==='text'&&!layer.locked)||
                    (!!builtin?.contentKey&&typeof selectedConfig.content[builtin.contentKey]==='string'&&!selectedConfig.layerOverrides?.[selectedLayerId]?.locked);
                  return editable?<button type="button" title="Doble clic para editar texto" aria-label="Editar texto aquí"
                    className="pointer-events-auto absolute top-0 right-0 translate-y-1.5 -translate-x-1.5 bg-[#FF6B00] text-black rounded px-2 py-1 text-[9px] font-bold shadow-lg"
                    onPointerDown={e=>e.stopPropagation()} onClick={()=>startInlineEdit(selectedLayerId)}>✎ EDITAR TEXTO</button>:null;
                })()}
                {(['nw','ne','sw','se'] as const).map(corner=><button key={corner} type="button"
                  className={`pointer-events-auto absolute z-40 w-4 h-4 border-2 border-white rounded-sm bg-sky-400 shadow-lg ${corner==='nw'?'-top-2 -left-2 cursor-nwse-resize':corner==='ne'?'-top-2 -right-2 cursor-nesw-resize':corner==='sw'?'-bottom-2 -left-2 cursor-nesw-resize':'-bottom-2 -right-2 cursor-nwse-resize'}`}
                  title={`Redimensionar desde esquina ${corner.toUpperCase()}`} aria-label={`Redimensionar desde ${corner}`}
                  onPointerDown={e=>beginTransform(e,'resize-layer',selectedLayerId,corner)}
                  onPointerMove={updateTransform} onPointerUp={stopTransform} onPointerCancel={stopTransform}/>)}
                <div className="absolute left-1/2 -top-7 h-5 border-l border-sky-300"/>
                <button type="button" title="Girar capa · Mayús para saltos de 15°" aria-label="Girar capa"
                  className="pointer-events-auto absolute left-1/2 -translate-x-1/2 -top-10 w-5 h-5 rounded-full bg-sky-300 border-2 border-slate-950 cursor-grab"
                  onPointerDown={e=>beginTransform(e,'rotate-layer',selectedLayerId)}
                  onPointerMove={updateTransform} onPointerUp={stopTransform} onPointerCancel={stopTransform}/>
              </div>}
              {!previewOnly && <div className="absolute inset-0 border-2 border-[#FF6B00] rounded pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,.5)]" />}
              {!previewOnly && <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-sm bg-white border border-[#FF6B00] pointer-events-none"/>}
              {!previewOnly && <button
                type="button"
                aria-label="Arrastrar para cambiar ancho y alto del componente"
                title="Redimensionar"
                className="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 z-40 w-6 h-6 bg-white text-[#FF6B00] rounded-md shadow-xl border-2 border-[#FF6B00] cursor-nwse-resize flex items-center justify-center"
                onPointerDown={e => beginTransform(e,'resize')}
                onPointerMove={updateTransform}
                onPointerUp={stopTransform}
                onPointerCancel={stopTransform}
              ><Maximize2 className="w-3 h-3" /></button>}
            </div>
            <div className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-mono pointer-events-none">
              {previewOnly?'VISTA LIMPIA · Solo previsualización':'Haz clic para editar capas · Espacio + arrastrar: desplazar vista'}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Browser Source URL & OBS Integration */}
        <div className="p-3 px-5 glass-panel border-t border-white/10 flex items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">URL Fuente OBS:</span>
            <code className="px-2.5 py-1 rounded bg-black/60 border border-white/10 font-mono text-sky-400 text-[11px]">
              {overlayUrl}
            </code>
            <button
              onClick={copyOverlayUrl}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white transition-colors"
            >
              {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedUrl ? '¡Copiado!' : 'Copiar URL'}</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-400 text-xs">
            <span className="hidden 2xl:inline">V Seleccionar · H Mano · Espacio mover · +/- Zoom</span>
            <span>Resolución sugerida: <strong>1920 × 1080</strong></span>
            <span>Fondo: <strong>Transparente</strong></span>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* 3. RIGHT PANEL: CONTEXTUAL INSPECTOR (5 TABS)            */}
      {/* ======================================================== */}
      {!focusMode && <div role="separator" aria-orientation="vertical" aria-label="Ajustar ancho inspector" title="Arrastra para cambiar el ancho del Inspector" className="studio-panel-divider"
        onPointerDown={e=>beginPanelDrag(e,'right')} onPointerMove={movePanelDrag} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}/>}
      {!focusMode && <aside aria-label="Inspector de propiedades" style={{width:panelWidths.right}} className="glass-panel studio-inspector-shell border-l border-white/10 flex flex-col shrink-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Inspector Tab Bar */}
        <div className="studio-inspector-header" aria-label="Herramientas de edición">
          <div className="studio-inspector-heading"><span>HERRAMIENTAS</span><span className="studio-inspector-hint">Selecciona un panel</span></div>
          <div className="studio-inspector-tabs" role="group" aria-label="Pestañas del inspector">
          {[
            { id: 'smart', label: 'Rápido', icon: '◉' },
            { id: 'layers', label: 'Capas', icon: '▧' },
            { id: 'content', label: 'Contenido', icon: '📝' },
            { id: 'design', label: 'Texto', icon: '🔤' },
            { id: 'geometry', label: 'Forma', icon: '📐' },
            { id: 'animation', label: 'Motion', icon: '⚡' },
            { id: 'branding', label: 'Logo', icon: '◈' },
            { id: 'broadcast', label: 'OBS', icon: '📡' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveInspectorTab(tab.id as any)}
              className={`studio-inspector-tab ${
                activeInspectorTab === tab.id 
                  ? 'bg-white/15 text-white shadow-sm border border-white/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          </div>
        </div>

        {/* Inspector Body */}
        {comparePublished&&<div className="studio-readonly-indicator"><ShieldCheck size={14}/> Vista publicada · inspector bloqueado <button type="button" onClick={()=>{setComparePublished(false);setPreviewOnly(false);}}>Volver a editar</button></div>}
        {comparePublished && publishedSelected && <div className="p-5 space-y-3 text-xs text-slate-300" role="status">
          <p className="text-[10px] tracking-[.16em] uppercase text-orange-300 font-bold">Snapshot publicado</p>
          <h3 className="font-semibold text-white text-base">{publishedSelected.name}</h3>
          <p>Estado <strong>Publicado</strong> · {publishedSelected.visibleInOBS?'Marcada al aire':'Fuera del aire'}</p>
          <p className="text-slate-400 leading-relaxed">Esta vista no acepta cambios. El borrador permanece intacto y puede editarse cuando regreses al modo Borrador.</p>
          <button type="button" className="studio-publish-cta" onClick={()=>{setComparePublished(false);setPreviewOnly(false);}}>Volver al borrador</button>
        </div>}
        {!comparePublished&&<div className="p-5 space-y-5 flex-1">
          {selectedIds.length>1 && activeInspectorTab==='layers' && <div className="rounded-xl border border-orange-400/25 bg-orange-400/10 p-3 text-xs space-y-2">
            <strong className="text-orange-200">{selectedIds.length} capas seleccionadas</strong>
            <p className="text-slate-300">Agrupa, alinea o distribuye desde la barra del lienzo. Arrastra cualquiera de las seleccionadas para moverlas juntas. Ctrl+clic para sumar o quitar capas.</p>
            <button className="text-orange-200 underline" onClick={()=>selectIds([])}>Limpiar selección</button>
          </div>}
          {activeInspectorTab==='smart'&&<SmartInspector config={selectedConfig} ids={selectedIds} onUpdate={handleUpdate}
            onOpenAdvanced={()=>setActiveInspectorTab('layers')} onEditText={startInlineEdit} onClearSelection={()=>selectIds([])}/>}
          {activeInspectorTab === 'layers' && (
            <LayerEditorPanel config={selectedConfig} selectedId={selectedIds.length===1?selectedLayerId:null} onSelect={selectOne} onSelectNewLayer={id=>selectIds([id])}
              onUpdate={handleUpdate} onBranding={()=>setActiveInspectorTab('branding')} onReplay={()=>setTimelineReplay(v=>v+1)} />
          )}
          {/* TAB 1: CONTENIDO */}
          {activeInspectorTab === 'content' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Textos & Metadatos
              </span>

              {selectedConfig.type === 'logo-bug' && <section className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 space-y-2">
                <h3 className="text-xs text-white font-bold">MOSCA · ELEMENTOS INDEPENDIENTES</h3>
                <p className="text-[11px] text-slate-400">Logo, indicador de vivo, nombre e icono pueden coexistir. Selecciónalos desde Capas para cambiar su apariencia individual.</p>
                {([['showProgramTitle','Mostrar nombre del programa',!selectedConfig.branding?.visible],['showIcon','Mostrar icono',!selectedConfig.branding?.visible]] as const).map(([key,label,fallback])=><label key={key} className="flex gap-2 items-center text-xs text-slate-200">
                  <input type="checkbox" className="accent-orange-500" checked={selectedConfig.content[key]??fallback} onChange={e=>handleContentChange(key,e.target.checked)}/>{label}
                </label>)}
              </section>}
              {selectedConfig.type === 'social-pill' && <SocialNetworksEditor content={selectedConfig.content}
                onChange={patch=>handleUpdate({content:{...selectedConfig.content,...patch}})}/>}
              {contentFieldsFor(selectedConfig.type,selectedConfig.content).editable.map(spec=>{
                const value=selectedConfig.content[spec.key];
                const update=(next:unknown)=>{
                  try{handleContentChange(spec.key,parseContentValue(spec,next));}
                  catch(error){console.warn('Campo de contenido inválido',spec.key,error);}
                };
                return <div key={spec.key} className="space-y-1.5 rounded-xl border border-white/5 bg-white/[0.015] px-2.5 py-2">
                  {spec.kind==='toggle'?<label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-xs text-slate-200">{spec.label}</span>
                    <input type="checkbox" className="accent-orange-500" checked={value === undefined ? (spec.key==='showLiveLabel'||spec.key==='showStatusDot'||spec.key==='showQuotationMarks'||spec.key==='showQuoteIcon'||spec.key==='showHeadingIcon') : Boolean(value)} onChange={event=>update(event.target.checked)}/>
                  </label>:<>
                    <label htmlFor={`content-${spec.key}`} className="block text-xs text-slate-200 font-medium">{spec.label}</label>
                    {spec.kind==='lines'||spec.kind==='multiline'?<textarea id={`content-${spec.key}`} rows={spec.kind==='lines'?4:3}
                      value={spec.kind==='lines'?(Array.isArray(value)?value.join('\n'):''):String(value??'')}
                      onChange={event=>update(event.target.value)} className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white" />:
                    spec.kind==='choice'?<select id={`content-${spec.key}`} value={String(value??spec.options?.[0]?.value??'')} onChange={event=>update(event.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white bg-slate-900">
                      {spec.options?.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>:
                    <input id={`content-${spec.key}`} type={spec.kind==='integer'?'number':'text'} min={spec.min} max={spec.max}
                      value={value===undefined?'':String(value)} onChange={event=>{if(spec.kind!=='integer'||event.target.value!=='')update(event.target.value);}}
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input text-white" />}
                  </>}
                  {spec.target&&<p className="text-[10px] text-slate-500">Afecta a: {spec.target} · editable también desde Capas</p>}
                  {spec.description&&<p className="text-[10px] text-slate-500">{spec.description}</p>}
                </div>;
              })}
              {contentFieldsFor(selectedConfig.type,selectedConfig.content).unknown.length>0&&<p role="status" className="text-amber-200 text-[11px] rounded-lg border border-amber-500/20 p-2">
                Campos heredados conservados sin edición directa (sin vínculo visual certificado): {contentFieldsFor(selectedConfig.type,selectedConfig.content).unknown.join(', ')}.
              </p>}
            </div>
          )}

          {/* TAB 2: TIPOGRAFÍA & ESTILO */}
          {activeInspectorTab === 'design' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Ajustes Tipográficos
              </span>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Familia Tipográfica</label>
                <select
                  value={selectedConfig.font.family}
                  onChange={(e) => handleFontChange('family', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white bg-slate-900"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Sans Moderno)</option>
                  <option value="Playfair Display">Playfair Display (Serif Editorial)</option>
                  <option value="Barlow Condensed">Barlow Condensed (Atlético / Títulos)</option>
                  <option value="JetBrains Mono">JetBrains Mono (Monospace / Datos)</option>
                  <option value="Space Grotesk">Space Grotesk (Geométrico)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumericControl label="Tamaño" value={selectedConfig.font.size} min={8} max={300} step={1} unit="px" onChange={v=>handleFontChange('size',v)} />

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Grosor (Weight)</label>
                  <select
                    value={selectedConfig.font.weight}
                    onChange={(e) => handleFontChange('weight', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white bg-slate-900"
                  >
                    <option value={400}>Regular (400)</option>
                    <option value={500}>Medium (500)</option>
                    <option value={600}>SemiBold (600)</option>
                    <option value={700}>Bold (700)</option>
                    <option value={800}>ExtraBold (800)</option>
                  </select>
                </div>
              </div>

              <ColorControl label="Color del texto" value={selectedConfig.font.color} onChange={v=>handleFontChange('color',v)}/>
              <div className="grid grid-cols-2 gap-3">
                <NumericControl label="Interlineado" value={selectedConfig.font.lineHeight} min={0.6} max={3} step={0.05} unit="×" onChange={v=>handleFontChange('lineHeight',v)} />

                <NumericControl label="Tracking" value={selectedConfig.font.letterSpacing} min={-20} max={80} step={0.5} unit="px" onChange={v=>handleFontChange('letterSpacing',v)} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Alineación</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => handleFontChange('align', align)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border capitalize ${
                        selectedConfig.font.align === align
                          ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-white'
                          : 'border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Inspector unificado de geometría y apariencia */}
          {activeInspectorTab==='geometry' && <div className="studio-inspector-body">
            <ComponentGeometryInspector geometry={selectedConfig.geometry}
              onChange={patch=>handleUpdate({geometry:{...selectedConfig.geometry,...patch}})}/>
          </div>}

          {/* TAB 4: ANIMACIÓN & MOTION ENGINE */}
          {activeInspectorTab === 'animation' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Motor de Animación
              </span>
              <div className="p-3 bg-[#FF6B00]/10 border border-[#FF6B00]/25 rounded-xl space-y-2">
                <p className="text-[11px] text-slate-200">Ahora el lienzo reproduce el mismo preset que utiliza OBS. Puedes ensayar sin salir al aire.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={()=>playPreview(false)} className="rounded-lg bg-white/10 hover:bg-white/20 text-white px-2 py-2 text-[11px] font-semibold flex items-center justify-center gap-1"><Play size={13}/> Probar entrada</button>
                  <button type="button" onClick={()=>playPreview(true)} className="rounded-lg bg-[#FF6B00] hover:bg-[#f07721] text-white px-2 py-2 text-[11px] font-semibold flex items-center justify-center gap-1"><PlayCircle size={13}/> Entrada + salida</button>
                </div>
                {publishedSelected?.visibleInOBS && <p className="text-amber-200 text-[11px]">La animación publicada sigue al aire. Los cambios de Motion de este borrador solo se verán tras una nueva publicación.</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Preset de Movimiento</label>
                <select
                  value={selectedConfig.animation.preset}
                  onChange={(e) => handleAnimationChange('preset', e.target.value as AnimationPreset)}
                  className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white bg-slate-900"
                >
                  <option value="apple-spring">Apple Spring (Suave & Elástico)</option>
                  <option value="cinematic-slide">Cinematic Slide (Desplazamiento Suave)</option>
                  <option value="mask-reveal">Mask Reveal (Revelado por Máscara)</option>
                  <option value="stagger-fade-up">Stagger Fade Up (Elevación Escalonada)</option>
                  <option value="scale-pop">Scale Pop (Impacto & Enfoque)</option>
                  <option value="magazine-fold">Magazine Fold (Giro Tridimensional)</option>
                  <option value="editorial-wipe">Editorial Wipe (Barrido por máscara)</option>
                  <option value="soft-focus">Soft Focus (Enfoque cinematográfico)</option>
                  <option value="diagonal-reveal">Diagonal Reveal (Revelado diagonal)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Duración Entrada (ms)</label>
                  <input
                    type="number"
                    step="50"
                    value={selectedConfig.animation.entryDurationMs}
                    onChange={(e) => handleAnimationChange('entryDurationMs', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Duración Salida (ms)</label>
                  <input
                    type="number"
                    step="50"
                    value={selectedConfig.animation.exitDurationMs}
                    onChange={(e) => handleAnimationChange('exitDurationMs', Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Retardo (ms)</span>
                  <input type="number" step="50" min="0" value={selectedConfig.animation.delayMs}
                    onChange={e=>handleAnimationChange('delayMs',Math.max(0,Number(e.target.value)))}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white font-mono" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Curva de movimiento</span>
                  <select value={selectedConfig.animation.easing} onChange={e=>handleAnimationChange('easing',e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white bg-slate-900">
                    <option value="cubic-bezier(0.16, 1, 0.3, 1)">Elegante</option>
                    <option value="ease-out">Suave</option>
                    <option value="ease-in-out">Natural</option>
                    <option value="linear">Lineal</option>
                  </select>
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Dirección de Entrada</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['up', 'down', 'left', 'right'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => handleAnimationChange('direction', dir)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border capitalize ${
                        selectedConfig.animation.direction === dir
                          ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-white'
                          : 'border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-xl glass-input cursor-pointer">
                <span className="text-xs text-slate-300 font-medium">Escalonar textos y etiquetas</span>
                <input
                  type="checkbox"
                  checked={selectedConfig.animation.staggerWords}
                  onChange={(e) => handleAnimationChange('staggerWords', e.target.checked)}
                  className="accent-[#FF6B00] rounded"
                />
              </label>
              {selectedType === 'ticker' && <div className="p-3 rounded-xl border border-[#FF6B00]/30 bg-[#FF6B00]/5 space-y-3">
                <h4 className="text-xs font-bold text-white">Cinta · movimiento continuo</h4>
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Duración del recorrido: {tickerSeconds(selectedConfig.content.speedSeconds)} s</span>
                  <input aria-label="Duración de recorrido de cinta" type="range" min="8" max="120" step="1" value={tickerSeconds(selectedConfig.content.speedSeconds)} className="w-full accent-[#FF6B00]"
                    onChange={e=>handleUpdate({content:{...selectedConfig.content,speedSeconds:Number(e.target.value)}})}/>
                  <span className="text-[10px] text-slate-500">Menos segundos = mayor velocidad. El ciclo se repite sin saltos.</span>
                </label>
                <label className="block space-y-1 text-xs text-slate-300">Dirección
                  <select value={selectedConfig.content.tickerDirection ?? 'left'} onChange={e=>handleUpdate({content:{...selectedConfig.content,tickerDirection:e.target.value}})} className="w-full glass-input rounded-lg p-2 bg-slate-900 text-white">
                    <option value="left">Hacia la izquierda</option><option value="right">Hacia la derecha</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  Pausar movimiento
                  <input type="checkbox" className="accent-[#FF6B00]" checked={Boolean(selectedConfig.content.tickerPaused)}
                    onChange={e=>handleUpdate({content:{...selectedConfig.content,tickerPaused:e.target.checked}})}/>
                </label>
              </div>}
            </div>
          )}

          {/* LOGO: saved as a local asset and shared with OBS Browser Source. */}
          {activeInspectorTab === 'branding' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Logo del programa</h3>
              <section className="rounded-xl p-3 bg-white/5 border border-white/10 space-y-3">
                <h4 className="text-xs font-bold text-white">Iconografía del componente</h4>
                <label className="block space-y-1 text-xs text-slate-300">Icono del diseño
                  <select value={selectedConfig.glyph?.mode ?? 'default'} className="w-full px-3 py-2 rounded-lg glass-input bg-slate-900 text-white"
                    onChange={e=>updateGlyph({mode:e.target.value as NonNullable<EditorialComponentConfig['glyph']>['mode']})}>
                    <option value="default">Icono original</option>
                    <option value="logo">Usar logo del programa</option>
                    <option value="image">Imagen personalizada</option>
                    <option value="none">Sin icono</option>
                  </select>
                </label>
                {selectedConfig.glyph?.mode==='logo' && !selectedConfig.branding?.assetUrl &&
                  <p role="status" className="text-[11px] text-amber-300">Sube primero un logo debajo. Puede sustituir al icono sin crear otra copia flotante.</p>}
                {selectedConfig.glyph?.mode==='image' && <label className="block border border-dashed border-white/20 p-2 rounded-lg text-[11px] text-slate-300 cursor-pointer">
                  {uploadingGlyph?'Cargando…':'Subir imagen de icono (PNG/JPG/WebP)'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingGlyph} onChange={e=>{void handleGlyphFile(e.target.files?.[0]);e.target.value='';}}
                    className="block w-full text-[11px] mt-1 file:rounded file:border-0 file:bg-orange-500 file:text-white"/>
                </label>}
                {selectedConfig.glyph?.mode==='image' && selectedConfig.glyph.assetUrl &&
                  <img src={selectedConfig.glyph.assetUrl} alt="Icono cargado" className="h-12 w-12 object-contain rounded bg-black/40"/>}
                <label className="block text-xs text-slate-300 space-y-1">
                  <span>Tamaño: {selectedConfig.glyph?.size ?? DEFAULT_COMPONENT_GLYPH.size}px</span>
                  <input type="range" className="w-full accent-[#FF6B00]" min="12" max="180" value={selectedConfig.glyph?.size ?? DEFAULT_COMPONENT_GLYPH.size}
                    onChange={e=>updateGlyph({size:Number(e.target.value)})}/>
                </label>
                <label className="block text-xs text-slate-300 space-y-1">
                  <span>Opacidad: {Math.round((selectedConfig.glyph?.opacity ?? 1)*100)}%</span>
                  <input type="range" className="w-full accent-[#FF6B00]" min="0" max="1" step=".05" value={selectedConfig.glyph?.opacity ?? 1}
                    onChange={e=>updateGlyph({opacity:Number(e.target.value)})}/>
                </label>
                <p className="text-[10px] text-slate-500">Aplica a insignias de conductor, redes, preguntas, versículos, cinta y espera. La mosca mantiene su propio control de posición.</p>
              </section>
              <p className="text-[11px] text-slate-400">Sube un PNG transparente, JPG o WebP (máx. 4 MB). La imagen queda en el servidor local, accesible por OBS.</p>
              <label className="flex flex-col gap-2 border border-dashed border-white/20 rounded-xl p-3 cursor-pointer hover:bg-white/5 text-xs text-slate-200">
                <span>{uploadingLogo ? 'Cargando imagen…' : 'Seleccionar o reemplazar logo'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingLogo}
                  onChange={e => { void handleLogoFile(e.target.files?.[0]); e.target.value=''; }}
                  className="text-[11px] file:bg-[#FF6B00] file:text-white file:rounded-lg file:border-none file:px-2 file:py-1" />
              </label>
              {uploadError && <p className="text-xs text-rose-400" role="alert">{uploadError}</p>}
              {(selectedConfig.branding?.assetUrl) && (
                <div className="bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:16px_16px] rounded-lg p-3 flex justify-center">
                  <img src={selectedConfig.branding.assetUrl} alt="Logo cargado" className="h-20 max-w-full object-contain" />
                </div>
              )}
              <label className="flex justify-between items-center text-xs text-slate-300">
                Mostrar logo en este componente
                <input type="checkbox" className="accent-[#FF6B00]" checked={selectedConfig.branding?.visible ?? false}
                  onChange={e => updateBranding({ visible: e.target.checked })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['width','Ancho del logo',24,1200],['x','Posición X',-1500,1920],
                  ['y','Posición Y',-1500,1080],['rotation','Rotación (°)',-360,360],
                ] as const).map(([key,label,min,max]) => (
                  <label key={key} className="text-xs text-slate-300 space-y-1">
                    <span>{label}</span>
                    <input type="number" min={min} max={max}
                      value={selectedConfig.branding?.[key] ?? DefaultBranding[key]}
                      onChange={e => updateBranding({ [key]: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs rounded-xl glass-input text-white font-mono" />
                  </label>
                ))}
              </div>
              <label className="text-xs text-slate-300 space-y-1 block">
                <span>Opacidad del logo: {Math.round((selectedConfig.branding?.opacity ?? 1) * 100)}%</span>
                <input type="range" min="0" max="1" step="0.01" className="w-full accent-[#FF6B00]"
                  value={selectedConfig.branding?.opacity ?? 1}
                  onChange={e => updateBranding({ opacity: Number(e.target.value) })} />
              </label>
              <button type="button" onClick={() => updateBranding({ visible:false })}
                className="px-3 py-2 text-xs rounded-lg bg-white/10 text-slate-300 hover:bg-white/20">
                Ocultar logo de este gráfico
              </button>
            </div>
          )}

          {/* TAB 5: EMISIÓN A OBS */}
          {activeInspectorTab === 'broadcast' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Integración con OBS Studio
              </span>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <div className="font-semibold text-white">Instrucciones para Browser Source:</div>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>En OBS Studio, agrega una fuente de tipo <strong>Browser (Navegador)</strong>.</li>
                  <li>Pega la URL del componente: <code className="text-[#FF6B00]">{overlayUrl}</code>.</li>
                  <li>Configura Ancho: <strong>1920</strong> y Alto: <strong>1080</strong>.</li>
                  <li>Marca "Cerrar la fuente cuando no esté visible".</li>
                </ol>
              </div>

              <button
                onClick={copyOverlayUrl}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/10 transition-colors"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl ? '¡Copiado al Portapapeles!' : 'Copiar URL para OBS'}</span>
              </button>
            </div>
          )}
        </div>}
      </aside>}
    </div>
  );
};
