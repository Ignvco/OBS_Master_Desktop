import React, {useState} from 'react';
import type {EditorialComponentConfig,GraphicLayer} from '../../types';
import {editableTemplateLayersFor} from '../../utils/graphicLayers';
import {dropLayerStack,isLayerStackLocked,layerStackIds,stepLayerStack} from '../../utils/layerStack';
import {ArrowDown,ArrowUp,Eye,EyeOff,GripVertical,ImagePlus,Layers3,Lock,LockOpen,Shapes,Type,Group,ChevronRight} from 'lucide-react';

interface Props {
  config:EditorialComponentConfig;
  selectedId:string|null;
  selectedIds?:string[];
  onSelect:(id:string|null,extend?:boolean)=>void;
  onUpdate:(patch:Partial<EditorialComponentConfig>)=>void;
  onOpenInspector:()=>void;
  onAddLayer:(kind:GraphicLayer['kind'])=>void;
}

const iconClass='p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors';

/** A single shared paint order, regardless of whether an item began in the template. */
export const WorkspaceLayerTree:React.FC<Props>=({config,selectedId,selectedIds=[],onSelect,onUpdate,onOpenInspector,onAddLayer})=>{
  const originals=editableTemplateLayersFor(config);
  const originalById=new Map(originals.map(item=>[item.id,item]));
  const added=config.layers??[];
  const byId=new Map(added.map(item=>[item.id,item]));
  const order=layerStackIds(config);
  const [dragged,setDragged]=useState<string|null>(null);
  const add=(kind:GraphicLayer['kind'])=>onAddLayer(kind);
  const reorder=(id:string,direction:'up'|'down')=>{
    const patch=stepLayerStack(config,id,direction);
    if(patch.layerOrder)onUpdate(patch);
  };
  const drop=(target:string)=>{
    if(!dragged)return;
    const patch=dropLayerStack(config,dragged,target);
    if(patch.layerOrder)onUpdate(patch);
    setDragged(null);
  };
  const updateVisibility=(id:string)=>{
    const custom=byId.get(id);
    if(custom)onUpdate({layers:added.map(item=>item.id===id?{...item,hidden:!item.hidden}:item)});
    else {
      const previous=config.layerOverrides?.[id]??{};
      onUpdate({layerOverrides:{...config.layerOverrides,[id]:{...previous,hidden:!previous.hidden}}});
    }
  };
  const updateLock=(id:string)=>{
    const custom=byId.get(id);
    if(custom)onUpdate({layers:added.map(item=>item.id===id?{...item,locked:!item.locked}:item)});
    else {
      const previous=config.layerOverrides?.[id]??{};
      onUpdate({layerOverrides:{...config.layerOverrides,[id]:{...previous,locked:!previous.locked}}});
    }
  };
  return <section aria-label="Orden y gestión de capas" className="border-t border-white/10 shrink-0 flex flex-col min-h-0">
    <div className="px-4 pt-4 pb-2 flex justify-between items-center">
      <span className="text-[10px] text-slate-300 uppercase font-bold tracking-[.15em] flex items-center gap-2"><Layers3 size={14}/> Capas del diseño</span>
      <span className="font-mono text-[10px] text-slate-500">{order.length}</span>
    </div>
    <div className="px-3 grid grid-cols-3 gap-1.5 pb-3">
      <button type="button" title="Añadir texto" onClick={()=>add('text')} className="studio-action-mini"><Type size={13}/> Texto</button>
      <button type="button" title="Añadir forma" onClick={()=>add('shape')} className="studio-action-mini"><Shapes size={13}/> Forma</button>
      <button type="button" title="Añadir imagen" onClick={()=>add('image')} className="studio-action-mini"><ImagePlus size={13}/> Imagen</button>
    </div>
    <p className="text-[10px] text-slate-500 px-4 pb-2">Arriba = delante. Arrastra o usa las flechas. Elementos originales y nuevos comparten el mismo orden.</p>
    <div className="px-2 pb-4 overflow-y-auto max-h-[40vh] space-y-1" onDragEnd={()=>setDragged(null)}>
      <button type="button" onClick={()=>onSelect(null)} className={`w-full flex items-center gap-2 text-left text-xs rounded-lg px-3 py-2 ${selectedId===null?'text-white bg-white/10':'text-slate-400 hover:bg-white/5'}`}>
        <ChevronRight size={12} className="text-[#FF6B00]"/> <span className="font-semibold truncate">{config.name}</span><span className="text-[9px] opacity-60 ml-auto">GRÁFICA</span>
      </button>
      {[...order].reverse().map((id,index)=>{
        const original=originalById.get(id);
        const custom=byId.get(id);
        if(!original&&!custom)return null;
        const layer=custom??config.layerOverrides?.[id]??{};
        const hidden=Boolean(layer.hidden);
        const locked=isLayerStackLocked(config,id);
        const selected=selectedIds.includes(id);
        const groupId=layer.groupId;
        const title=custom?.name??original?.label??id;
        const Icon=custom?.kind==='text'?Type:custom?.kind==='image'?ImagePlus:custom?.kind==='shape'?Shapes:Layers3;
        return <div key={id} draggable={!locked} onDragStart={event=>{
          if(locked){event.preventDefault();return;}
          setDragged(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);
        }} onDragOver={event=>{if(dragged&&dragged!==id){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
        onDrop={event=>{event.preventDefault();drop(id);}}
        className={`studio-layer-row group flex items-center ${selected?'studio-layer-selected':''} ${dragged===id?'opacity-40':''}`}>
          <GripVertical size={13} className={`shrink-0 ml-1 ${locked?'text-slate-700':'text-slate-500 cursor-grab'}`}/>
          <button type="button" className="flex-1 min-w-0 text-left pl-1 py-2 flex gap-1.5 items-center" title={title}
            onClick={event=>{onSelect(id,event.ctrlKey||event.metaKey||event.shiftKey);onOpenInspector();}}>
            <Icon size={13} className={custom?'text-sky-300':'text-[#FF6B00]'} />
            <span className="truncate text-xs">{title}</span>
            {groupId&&<Group size={11} className="text-orange-300 shrink-0" aria-label="Agrupado"/>}
          </button>
          <button type="button" className={iconClass} title={`Subir ${title} (hacia delante)`} aria-label={`Subir ${title}`}
            disabled={locked||index===0} onClick={()=>reorder(id,'up')}><ArrowUp size={13}/></button>
          <button type="button" className={iconClass} title={`Bajar ${title} (hacia atrás)`} aria-label={`Bajar ${title}`}
            disabled={locked||index===order.length-1} onClick={()=>reorder(id,'down')}><ArrowDown size={13}/></button>
          <button type="button" className={iconClass} title={hidden?'Mostrar capa':'Ocultar capa'} aria-label={`${hidden?'Mostrar':'Ocultar'} ${title}`} onClick={()=>updateVisibility(id)}>{hidden?<EyeOff size={13}/>:<Eye size={13}/>}</button>
          <button type="button" className={iconClass} title={locked?'Desbloquear capa':'Bloquear capa'} aria-label={`${locked?'Desbloquear':'Bloquear'} ${title}`} onClick={()=>updateLock(id)}>{locked?<Lock size={13}/>:<LockOpen size={13}/>}</button>
        </div>;
      })}
      {config.layerOrder&&<p className="px-3 py-2 text-[10px] text-emerald-400">Orden unificado activo · compartido con OBS</p>}
    </div>
  </section>;
};
