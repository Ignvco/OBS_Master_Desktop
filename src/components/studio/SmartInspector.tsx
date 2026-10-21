import React, {useEffect,useState} from 'react';
import {BookmarkPlus,BookOpen,Check,Lock,RefreshCw,Save,Trash2,Type} from 'lucide-react';
import type {EditorialComponentConfig,GraphicLayer,LayerOverride} from '../../types';
import {editableTemplateLayersFor} from '../../utils/graphicLayers';
import {isLocked,moveSelection} from '../../utils/workspaceEditing';
import {
  applyCompositionPreset,applyStyleToSelection,captureLayerStyle,compositionSnapshot,
  updateSelectionProperty
} from '../../utils/studioPresets';
import type {StudioPreset} from '../../utils/studioPresets';
import {StudioPresetsService} from '../../services/studioPresetsService';
import {NumericControl,ColorControl} from './PrecisionControls';

interface Props {
  config: EditorialComponentConfig;
  ids: string[];
  onUpdate:(patch:Partial<EditorialComponentConfig>)=>void;
  onOpenAdvanced:()=>void;
  onEditText:(id:string)=>void;
  onClearSelection:()=>void;
}
const field='w-full rounded-lg border border-white/10 bg-[#11151d] text-white px-2 py-2 text-xs outline-none focus:border-orange-400/60';
const control='rounded-lg border border-white/10 px-2.5 py-2 text-xs hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed';
const wrap='rounded-xl border border-white/10 bg-[#0C0E13] p-3 space-y-3';
const createId=()=>`preset-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;

export const SmartInspector:React.FC<Props>=({config,ids,onUpdate,onOpenAdvanced,onEditText,onClearSelection})=>{
  const originals=editableTemplateLayersFor(config);
  const isOriginal=(id:string)=>originals.some(x=>x.id===id);
  const firstId=ids[0];
  const custom=config.layers?.find(l=>l.id===firstId);
  const original=originals.find(l=>l.id===firstId);
  const first=(custom??config.layerOverrides?.[firstId]??{}) as GraphicLayer|LayerOverride;
  const blocked=ids.every(id=>isLocked(config,id));
  const allText=ids.length>0&&ids.every(id=>config.layers?.some(l=>l.id===id&&l.kind==='text')||originals.some(l=>l.id===id&&!!l.contentKey));
  const single=ids.length===1;
  const [linked,setLinked]=useState(true);
  const [presetName,setPresetName]=useState('');
  const [presets,setPresets]=useState<StudioPreset[]>([]);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  useEffect(()=>{let active=true;
    StudioPresetsService.read().then(x=>{if(active)setPresets(x);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[]);
  const patch=(key:keyof LayerOverride,value:unknown)=>onUpdate(updateSelectionProperty(config,ids,key,value));
  const resize=(key:'width'|'height',value:number)=>{
    if(!single||!custom)return;
    if(linked){
      const ratio=custom.height>0&&custom.width>0?custom.width/custom.height:1;
      const companion=key==='width'?{height:Math.max(16,Math.round(value/ratio))}:{width:Math.max(16,Math.round(value*ratio))};
      onUpdate({layers:(config.layers??[]).map(l=>l.id===custom.id?{...l,[key]:value,...companion}:l)});
    }else patch(key,value);
  };
  const hasStyle=firstId&&Object.keys(captureLayerStyle(config,firstId)).length>0;
  const save=async(kind:'style'|'composition')=>{
    if(!presetName.trim()){setError('Asigna un nombre al estilo o composición.');return;}
    if(kind==='style'&&!hasStyle){setError('Personaliza primero algún atributo de la capa.');return;}
    setWorking(true);setError('');setMessage('');
    try{
      const item:StudioPreset={id:createId(),name:presetName.trim().slice(0,70),kind,createdAt:new Date().toISOString(),
        ...(kind==='style'?{style:captureLayerStyle(config,firstId)}:{sourceType:config.type,composition:compositionSnapshot(config)})};
      setPresets(await StudioPresetsService.save(item));setPresetName('');setMessage('Guardado en la Biblioteca de estilos de esta estación.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el estilo');}
    finally{setWorking(false);}
  };
  const apply=(preset:StudioPreset)=>{
    if(preset.kind==='style'){
      // Styles are applied to drafts; explicit publishing is required before OBS updates.
      if(!ids.length){setError('Selecciona una o varias capas para aplicar el estilo.');return;}
      onUpdate(applyStyleToSelection(config,ids,preset.style??{}));
    }else{
      if(preset.sourceType!==config.type){setError('Esta composición pertenece a otro tipo de gráfica.');return;}
      // The current production source is immutable during draft editing.
      if(!window.confirm('Aplicar esta composición reemplazará la composición actual. Puedes deshacer la operación. ¿Continuar?'))return;
      onClearSelection();onUpdate(applyCompositionPreset(config,preset));
    }
    setError('');setMessage(`Aplicado «${preset.name}». Puedes deshacer el cambio.`);
  };
  const remove=async(preset:StudioPreset)=>{
    if(!window.confirm(`¿Eliminar «${preset.name}» de la Biblioteca? Los diseños que ya lo utilizaron se conservarán.`))return;
    setWorking(true);setError('');
    try{setPresets(await StudioPresetsService.delete(preset.id));setMessage('Estilo eliminado.');}
    catch(e){setError(e instanceof Error?e.message:'Error al eliminar');}
    finally{setWorking(false);}
  };
  const numeric=(key:keyof LayerOverride,defaultValue:number)=>{
    const obj=first as unknown as Record<string,unknown>;
    const value=obj[key];
    return typeof value==='number'&&Number.isFinite(value)?value:defaultValue;
  };
  const palette=(key:keyof LayerOverride,defaultColor:string)=>{
    const value=(first as unknown as Record<string,unknown>)[key];
    return typeof value==='string'?value:defaultColor;
  };
  return <div className="space-y-4 text-white">
    <div className="rounded-xl p-3 border border-emerald-400/20 bg-emerald-400/5 text-[11px] text-emerald-100"><strong>EDICIÓN SEGURA</strong> · Los estilos modifican solo el borrador. OBS recibe cambios únicamente al usar Publicar.</div>
    <section className={wrap}>
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] tracking-widest uppercase text-orange-300 font-bold">Inspector inteligente</p>
          <h3 className="font-bold text-sm mt-1">{!ids.length?'Selecciona un elemento':single?(custom?.name??original?.label??'Capa'):`${ids.length} capas seleccionadas`}</h3></div>
        <button type="button" title="Abrir inspector avanzado" onClick={onOpenAdvanced} className={control}>Avanzado ↗</button>
      </div>
      {!ids.length?<p className="text-xs text-slate-400 leading-relaxed">Selecciona texto, formas o imágenes en el lienzo para ver solo los parámetros relevantes. Haz doble clic sobre un texto para editarlo directamente.</p>:
      <><p className="text-[11px] text-slate-400">{single?(custom?`Capa libre · ${custom.kind}`:'Elemento original de la plantilla'):'Los cambios se aplican a las capas desbloqueadas. Los valores mixtos toman como referencia la primera capa.'}</p>
      {blocked&&<p className="text-[11px] text-amber-300 flex gap-2 items-center"><Lock size={13}/> Selección bloqueada. Desbloquéala desde Capas.</p>}
      <fieldset disabled={blocked} className="space-y-3 disabled:opacity-50">
        {single&&custom&&<div className="grid grid-cols-2 gap-2">
          <NumericControl label="Ancho" value={custom.width} min={16} max={3840} onChange={v=>resize('width',v)}/>
          <NumericControl label="Alto" value={custom.height} min={16} max={2160} onChange={v=>resize('height',v)}/>
          <button className={`${control} col-span-2 flex gap-2 items-center justify-center ${linked?'text-orange-300 border-orange-400/30':''}`} onClick={()=>setLinked(v=>!v)} title="Mantener proporción al cambiar ancho o alto" type="button">
            {linked?'◉':'○'} Mantener proporción {linked?'activado':'desactivado'}
          </button>
        </div>}
        <div className="grid grid-cols-2 gap-2">
          <NumericControl label={single?'X':'Mover X'} value={single?numeric('x',single&&custom?custom.x:0):0} min={-3840} max={3840} onChange={v=>single?patch('x',v):onUpdate(moveSelection(config,ids,v,0))}/>
          <NumericControl label={single?'Y':'Mover Y'} value={single?numeric('y',single&&custom?custom.y:0):0} min={-2160} max={2160} onChange={v=>single?patch('y',v):onUpdate(moveSelection(config,ids,0,v))}/>
          <NumericControl label="Rotación" value={numeric('rotation',0)} unit="°" min={-360} max={360} onChange={v=>patch('rotation',v)}/>
          <NumericControl label="Opacidad" value={numeric('opacity',1)*100} unit="%" min={0} max={100} step={5} onChange={v=>patch('opacity',v/100)}/>
        </div>
        {(allText||custom?.kind==='shape'||ids.some(id=>isOriginal(id)))&&<ColorControl label="Color principal" value={palette('color',config.font.color)} onChange={v=>patch('color',v)}/>}
        {single&&custom?.kind==='shape'&&<>
          <ColorControl label="Relleno" value={palette('backgroundColor','#FF6B00')} onChange={v=>patch('backgroundColor',v)} transparent/>
          <NumericControl label="Radio de esquinas" value={numeric('borderRadius',0)} min={0} max={1000} onChange={v=>patch('borderRadius',v)}/>
        </>}
        {allText&&<>
          <NumericControl label="Tamaño de fuente" value={numeric('fontSize',config.font.size)} min={8} max={600} onChange={v=>patch('fontSize',v)}/>
          <div className="grid grid-cols-3 gap-1.5">
            {(['left','center','right'] as const).map(a=><button type="button" key={a} className={control} onClick={()=>patch('textAlign',a)}>{a==='left'?'Izq.':a==='center'?'Centro':'Der.'}</button>)}
          </div>
          {single&&(custom?.kind==='text'||(original?.contentKey&&typeof config.content[original.contentKey]==='string'))&&
          <button type="button" className="w-full rounded-lg p-2.5 bg-orange-500/15 border border-orange-500/30 text-orange-100 flex justify-center gap-2 items-center" onClick={()=>onEditText(firstId)}><Type size={14}/> Editar texto sobre el lienzo</button>}
        </>}
      </fieldset></>}
    </section>
    <section className={wrap} aria-label="Biblioteca de estilos reutilizables">
      <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] uppercase tracking-widest font-bold text-orange-300 flex items-center gap-1"><BookOpen size={14}/> Estilos de autor</p><p className="text-[11px] text-slate-400 mt-1">Estilos para capas y composiciones completas, editables después de aplicarlos.</p></div>
        <button className={control} type="button" onClick={()=>{setError('');void StudioPresetsService.read().then(setPresets).catch(e=>setError(e.message));}} title="Recargar biblioteca"><RefreshCw size={14}/></button>
      </div>
      <label className="block space-y-1"><span className="text-[10px] uppercase text-slate-400">Nombre del estilo</span>
        <input value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={70} className={field} placeholder="Ej.: Banner editorial / Espera noche"/></label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={working||!ids.length||!hasStyle} className={`${control} flex items-center gap-1 justify-center`} onClick={()=>void save('style')} title="Guarda colores, tipografía, sombras, máscara y degradados sin copiar la posición"><BookmarkPlus size={13}/> Guardar estilo</button>
        <button type="button" disabled={working} className={`${control} flex items-center gap-1 justify-center`} onClick={()=>void save('composition')} title="Guarda el diseño completo de este tipo de componente"><Save size={13}/> Composición</button>
      </div>
      {presets.length===0&&<p className="text-[11px] text-slate-500 py-2">Todavía no hay estilos guardados en esta estación.</p>}
      {presets.length>0&&<div className="max-h-80 overflow-y-auto space-y-1.5">
        {presets.map(p=>{
          const compatible=p.kind==='style'?ids.length>0:p.sourceType===config.type;
          return <div key={p.id} className="flex gap-2 items-center border border-white/10 bg-black/20 rounded-lg p-2">
            <span className="w-4 h-4 shrink-0 rounded-md border border-white/20" style={{background:p.kind==='style'?(p.style?.backgroundColor&&p.style.backgroundColor!=='transparent'?p.style.backgroundColor:p.style?.color??'#FF6B00'):'#171719'}} aria-hidden="true"/>
            <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold truncate" title={p.name}>{p.name}</p><p className="text-[9px] text-slate-500 uppercase">{p.kind==='style'?'Estilo de capa':`Composición · ${p.sourceType}`}</p></div>
            <button disabled={!compatible||working} type="button" className={`${control} text-orange-300`} onClick={()=>apply(p)}>Aplicar</button>
            <button disabled={working} type="button" title="Eliminar estilo" className={`${control} text-rose-300`} onClick={()=>void remove(p)}><Trash2 size={13}/></button>
          </div>;
        })}
      </div>}
      {message&&<p role="status" className="text-[11px] text-emerald-300 flex gap-1"><Check size={13}/>{message}</p>}
      {error&&<p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <p className="text-[10px] text-slate-500">Los estilos se guardan en AppData e ingresan al Recovery Center. No afectan a diseños anteriores hasta que pulses Aplicar.</p>
    </section>
  </div>;
};
