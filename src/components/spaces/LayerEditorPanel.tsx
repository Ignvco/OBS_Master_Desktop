import React, { useState } from 'react';
import type { EditorialComponentConfig, GraphicLayer, LayerOverride } from '../../types';
import { editableTemplateLayersFor, makeGraphicLayer } from '../../utils/graphicLayers';
import { uploadLogo } from '../../services/logoUpload';
import { DEFAULT_LAYER_MOTION, normalizeLayerMotion } from '../../utils/layerTimeline';
import type {LayerMotion,LayerEffect} from '../../utils/layerTimeline';
import { Copy, ImagePlus, Layers3, Lock, LockOpen, Eye, EyeOff, Trash2, Type, Shapes, Play, Clock3, Sparkles, ChevronDown } from 'lucide-react';
import { NumericControl, ColorControl } from '../studio/PrecisionControls';
import { shapePresets } from '../../utils/creativeStyles';
import type { StyledLayer, ShapePreset,GradientMode,ShadowPreset } from '../../utils/creativeStyles';
import {creativeComposition,creativeRecipes} from '../../utils/creativeCompositions';
import {stepLayerStack} from '../../utils/layerStack';

interface Props {
  config: EditorialComponentConfig;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSelectNewLayer:(id:string)=>void;
  onUpdate: (patch: Partial<EditorialComponentConfig>) => void;
  onBranding: () => void;
  onReplay: () => void;
}

const field = 'w-full rounded-lg border border-white/10 bg-[#11151d] px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FF6B00]';
const cap = 'block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1';

export const LayerEditorPanel: React.FC<Props> = ({config,selectedId,onSelect,onSelectNewLayer,onUpdate,onBranding,onReplay}) => {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [showRecipes,setShowRecipes]=useState(false);
  const [uploadError, setUploadError] = useState('');
  const builtin = editableTemplateLayersFor(config);
  const custom = config.layers ?? [];
  const chosenBuiltin = builtin.find(x => x.id === selectedId);
  const chosenCustom = custom.find(x => x.id === selectedId);
  const override = chosenBuiltin ? config.layerOverrides?.[chosenBuiltin.id] ?? {} : null;
  const updateBuiltin = (patch: LayerOverride) => {
    if (!chosenBuiltin) return;
    onUpdate({layerOverrides: {...config.layerOverrides,[chosenBuiltin.id]:{...override,...patch}}});
  };
  const updateCustom = (patch: Partial<GraphicLayer>) => {
    if (!chosenCustom) return;
    onUpdate({layers: custom.map(x => x.id === chosenCustom.id ? {...x,...patch} : x)});
  };
  const addLayer = (kind: GraphicLayer['kind']) => {
    const created = makeGraphicLayer(kind,custom.length);
    onUpdate({layers:[...custom,created]});
    onSelectNewLayer(created.id);
  };
  const duplicate = () => {
    if (!chosenCustom) return;
    const newLayer = {...chosenCustom,id:`layer-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:`${chosenCustom.name} (copia)`,x:chosenCustom.x+20,y:chosenCustom.y+20,zIndex:custom.length+10};
    onUpdate({layers:[...custom,newLayer]}); onSelectNewLayer(newLayer.id);
  };
  const remove = () => {
    if (!chosenCustom) return;
    onUpdate({layers:custom.filter(x=>x.id !== chosenCustom.id)});
    onSelect(null);
  };
  const reorder = (direction:-1|1) => {
    if (!selectedId)return;
    const patch=stepLayerStack(config,selectedId,direction===1?'up':'down');
    if(patch.layerOrder)onUpdate(patch);
  };
  const handleImage = async (file?:File) => {
    if (!file || !chosenCustom || chosenCustom.kind !== 'image') return;
    setUploadBusy(true);setUploadError('');
    try { updateCustom({assetUrl:await uploadLogo(file)}); }
    catch(e:any) {setUploadError(e.message || 'No se pudo importar imagen');}
    finally {setUploadBusy(false);}
  };
  const changeNumeric = (key: keyof LayerOverride & keyof GraphicLayer, value: string) => {
    if (value.trim() === '') return;
    const n = Number(value); if (!Number.isFinite(n)) return;
    if (chosenCustom) updateCustom({[key]:n}); else if (chosenBuiltin) updateBuiltin({[key]:n});
  };
  const current = chosenCustom ?? override;
  const updateAppearance=(patch:StyledLayer)=>{if(chosenCustom)updateCustom(patch);else if(chosenBuiltin)updateBuiltin(patch);};
  const num=(key:keyof LayerOverride & keyof GraphicLayer,value:number)=>changeNumeric(key,String(value));
  const currentValue=(key:keyof LayerOverride & keyof GraphicLayer,fallback=0):number=>
    Number((current as GraphicLayer|LayerOverride|undefined)?.[key]??fallback);
  const setColor=(key:'color'|'backgroundColor'|'gradientFrom'|'gradientTo'|'borderColor',value:string)=>
    updateAppearance({[key]:value} as StyledLayer);
  const motion=normalizeLayerMotion((current as GraphicLayer|LayerOverride|undefined)?.motion);
  const changeMotion=(patch:Partial<LayerMotion>)=>{
    const value={...motion,...patch};
    if(chosenCustom) updateCustom({motion:value});
    else if(chosenBuiltin) updateBuiltin({motion:value});
  };
  const totalMs=motion.entryMs+(motion.holdMs?motion.holdMs+motion.exitMs:0);

  return <div className="space-y-4 text-xs">
    <div>
      <div className="flex gap-2 items-center mb-2"><Layers3 className="w-4 h-4 text-[#FF6B00]"/><h3 className="font-bold tracking-wide text-white">ELEMENTOS DEL DISEÑO</h3></div>
      <p className="text-slate-400 text-[11px]">Selecciona una capa aquí o haz clic en el lienzo. Flechas: mover 1 px · Mayús+flechas: 10 px · Supr: eliminar capa nueva. Los ajustes modifican el borrador; usa Publicar para llevarlos a OBS.</p>
    </div>
    {config.visibleInOBS && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5 text-[11px] text-amber-100">
      <strong>Atención: gráfica activa.</strong> El borrador puede editarse sin afectar la emisión. Retira la gráfica del aire únicamente cuando decidas publicar cambios.
    </div>}
    <section className="rounded-xl border border-[#FF6B00]/25 bg-[#FF6B00]/[0.06] overflow-hidden" aria-label="Composiciones creativas">
      <button className="w-full flex items-center justify-between gap-2 p-3 text-left text-[11px] text-orange-100 font-semibold"
        onClick={()=>setShowRecipes(p=>!p)} aria-expanded={showRecipes}>
        <span className="flex items-center gap-2"><Sparkles size={15} className="text-[#FF6B00]"/> Composiciones creativas</span>
        <ChevronDown size={14} className={showRecipes?'rotate-180 transition-transform':'transition-transform'}/>
      </button>
      {showRecipes&&<div className="px-3 pb-3 space-y-2">
        <p className="text-[10px] leading-relaxed text-slate-400">Puntos de partida desmontables: cada forma y texto es editable. Las capas originales solo se ocultan, nunca se borran. Deshacer revierte el diseño.</p>
        {creativeRecipes.map(recipe=><button type="button" key={recipe.id} className="w-full p-2.5 text-left rounded-lg border border-white/10 bg-black/25 hover:border-[#FF6B00]/50 hover:bg-white/5 transition-colors"
          onClick={()=>{
            if(custom.length && !window.confirm('Este diseño agregará capas nuevas conservando las existentes. ¿Continuar?'))return;
            onUpdate(creativeComposition(config,recipe.id));onSelect(null);setShowRecipes(false);
          }}>
          <span className="block text-white text-[11px] font-bold">{recipe.name}</span>
          <span className="block text-slate-400 text-[10px] mt-0.5">{recipe.detail}</span>
        </button>)}
      </div>}
    </section>
    <div className="grid grid-cols-3 gap-1.5">
      <button type="button" className="rounded-lg py-2 bg-white/10 hover:bg-white/15 flex items-center justify-center gap-1" onClick={()=>addLayer('text')}><Type size={13}/> Texto</button>
      <button type="button" className="rounded-lg py-2 bg-white/10 hover:bg-white/15 flex items-center justify-center gap-1" onClick={()=>addLayer('shape')}><Shapes size={13}/> Forma</button>
      <button type="button" className="rounded-lg py-2 bg-white/10 hover:bg-white/15 flex items-center justify-center gap-1" onClick={()=>addLayer('image')}><ImagePlus size={13}/> Imagen</button>
    </div>
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-slate-400">
      El orden y la selección se controlan desde <strong className="text-white">Capas del diseño</strong>, en el panel izquierdo.
      Los elementos originales y añadidos ya no tienen listas de profundidad separadas.
    </div>
    {!selectedId && <div className="p-3 border border-dashed border-white/15 rounded-xl text-slate-400">Elige un elemento para editarlo, o arrastra el fondo para mover el componente completo.</div>}
    {(chosenBuiltin||chosenCustom) && <>
      <div className="flex justify-between items-center"><span className="text-white font-bold">{chosenBuiltin?.label||chosenCustom?.name}</span><span className="text-[10px] text-slate-400">{chosenCustom ? 'CAPA LIBRE':'PLANTILLA'}</span></div>
      {chosenCustom&&<label><span className={cap}>Nombre de capa</span><input className={field} value={chosenCustom.name} onChange={e=>updateCustom({name:e.target.value})}/></label>}
      {chosenBuiltin?.contentKey && typeof config.content[chosenBuiltin.contentKey] === 'string' && <label><span className={cap}>Texto</span><textarea rows={2} className={`${field} resize-y`} value={config.content[chosenBuiltin.contentKey]} onChange={e=>onUpdate({content:{...config.content,[chosenBuiltin.contentKey!]:e.target.value}})}/></label>}
      {chosenCustom?.kind==='text'&&<label><span className={cap}>Texto</span><textarea rows={3} className={`${field} resize-y`} value={chosenCustom.text??''} onChange={e=>updateCustom({text:e.target.value})}/></label>}
      {chosenCustom?.kind==='image'&&<label className="block"><span className={cap}>Imagen PNG, JPG o WebP</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadBusy} className={field} onChange={e=>{void handleImage(e.target.files?.[0]);e.target.value='';}}/>{uploadError&&<span className="text-rose-400">{uploadError}</span>}{chosenCustom.assetUrl&&<img src={chosenCustom.assetUrl} alt="Vista previa" className="max-h-24 object-contain mx-auto mt-2"/>}</label>}
      {(selectedId==='logo' && config.type==='logo-bug' || selectedId==='brand-logo') && <button type="button" onClick={onBranding} className="w-full p-2 bg-[#FF6B00]/20 border border-[#FF6B00]/30 rounded-xl text-white">Abrir ajustes del logo original</button>}
      <section className="rounded-xl border border-white/10 bg-[#0C0E13] p-3 space-y-3" aria-label="Transformación precisa">
        <strong className="text-[10px] tracking-wider uppercase text-white">Transformar · Arrastra ↔ o edita valores</strong>
        <div className="grid grid-cols-2 gap-2">
          <NumericControl label="X" value={currentValue('x')} onChange={v=>num('x',v)} min={-1920} max={3840}/>
          <NumericControl label="Y" value={currentValue('y')} onChange={v=>num('y',v)} min={-1080} max={2160}/>
          <NumericControl label="Ancho" value={currentValue('width',chosenCustom?.width??250)} onChange={v=>num('width',v)} min={16} max={3840}/>
          <NumericControl label="Alto" value={currentValue('height',chosenCustom?.height??80)} onChange={v=>num('height',v)} min={16} max={2160}/>
          <NumericControl label="Rotación" value={currentValue('rotation')} onChange={v=>num('rotation',v)} min={-360} max={360} unit="°"/>
          <NumericControl label="Opacidad" value={currentValue('opacity',1)*100} onChange={v=>num('opacity',v/100)} min={0} max={100} step={5} unit="%"/>
        </div>
        <p className="text-[10px] text-slate-500">Edición directa, botones ± y arrastre sobre el nombre. Mayús al arrastrar: ajuste fino.</p>
      </section>
      <section className="rounded-xl border border-white/10 bg-[#0C0E13] p-3 space-y-3" aria-label="Apariencia creativa">
        <strong className="text-[10px] tracking-wider uppercase text-white">Apariencia · Estilos independientes</strong>
        <label><span className={cap}>Silueta / máscara</span>
          <select className={field} value={current?.shapePreset??'rectangle'} onChange={e=>updateAppearance({shapePreset:e.target.value as ShapePreset})}>
            {shapePresets.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ColorControl label={chosenCustom?.kind==='text'?'Texto':'Color principal'} value={(current as any)?.[chosenCustom?.kind==='text'?'color':'backgroundColor']??(chosenCustom?.kind==='text'?'#FFFFFF':'#FF6B00')}
            onChange={v=>setColor(chosenCustom?.kind==='text'?'color':'backgroundColor',v)} transparent={chosenCustom?.kind!=='text'}/>
          {chosenCustom?.kind==='text'&&<ColorControl label="Fondo" value={chosenCustom.backgroundColor??'transparent'} onChange={v=>setColor('backgroundColor',v)} transparent/>}
        </div>
        <label><span className={cap}>Degradado</span>
          <select className={field} value={current?.gradientMode??'none'} onChange={e=>updateAppearance({gradientMode:e.target.value as GradientMode})}>
            <option value="none">Color sólido</option><option value="linear">Lineal</option><option value="radial">Radial</option>
          </select>
        </label>
        {current?.gradientMode&&current.gradientMode!=='none'&&<>
          <div className="grid grid-cols-2 gap-2">
            <ColorControl label="Desde" value={current.gradientFrom??'#FF6B00'} onChange={v=>setColor('gradientFrom',v)}/>
            <ColorControl label="Hasta" value={current.gradientTo??'#241027'} onChange={v=>setColor('gradientTo',v)}/>
          </div>
          {current.gradientMode==='linear'&&<NumericControl label="Ángulo" value={current.gradientAngle??135} min={0} max={360} step={5} unit="°" onChange={v=>updateAppearance({gradientAngle:v})}/>}
        </>}
        <div className="grid grid-cols-2 gap-2">
          <NumericControl label="Radio" value={currentValue('borderRadius')} min={0} max={1000} onChange={v=>num('borderRadius',v)}/>
          <NumericControl label="Borde" value={currentValue('borderWidth')} min={0} max={40} onChange={v=>num('borderWidth',v)}/>
        </div>
        {(current?.borderWidth??0)>0&&<ColorControl label="Color del borde" value={current?.borderColor??'#FFFFFF'} onChange={v=>setColor('borderColor',v)}/>}
        <label><span className={cap}>Sombra / luz</span>
          <select className={field} value={current?.shadowPreset??'none'} onChange={e=>updateAppearance({shadowPreset:e.target.value as ShadowPreset})}>
            <option value="none">Sin sombra</option><option value="soft">Difusa</option><option value="lifted">Elevada</option>
            <option value="glow">Resplandor</option><option value="deep">Cinematográfica</option>
          </select>
        </label>
        <button type="button" className="w-full rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 p-2 text-[11px] text-slate-200" onClick={()=>updateAppearance({shadowPreset:'none'})}>
          Quitar sombra de ESTA capa (caja y texto)
        </button>
        {chosenBuiltin && Object.keys(override ?? {}).length>0 && <button type="button" className="w-full rounded-lg border border-orange-400/20 bg-orange-500/5 hover:bg-orange-500/10 p-2 text-[11px] text-orange-200" onClick={()=>{
          if(!window.confirm('¿Restablecer todos los ajustes de esta pieza original? El contenido del texto no se eliminará.'))return;
          const next={...config.layerOverrides};delete next[chosenBuiltin.id];onUpdate({layerOverrides:next});
        }}>Restablecer estilos de esta pieza original</button>}
        {chosenCustom&&<label><span className={cap}>Mezcla de capas</span>
          <select className={field} value={chosenCustom.blendMode??'normal'} onChange={e=>updateCustom({blendMode:e.target.value as NonNullable<GraphicLayer['blendMode']>})}>
            <option value="normal">Normal</option><option value="multiply">Multiplicar</option><option value="screen">Pantalla</option><option value="overlay">Superponer</option>
          </select>
        </label>}
      </section>
      {chosenCustom?.kind==='text'&&<section className="rounded-xl border border-white/10 bg-[#0C0E13] p-3 space-y-3" aria-label="Tipografía individual">
        <strong className="text-[10px] tracking-wider uppercase text-white">Tipografía · Capa independiente</strong>
        <label><span className={cap}>Familia</span><select className={field} value={chosenCustom.fontFamily??'Plus Jakarta Sans'} onChange={e=>updateCustom({fontFamily:e.target.value})}>
          {['Plus Jakarta Sans','Barlow Condensed','Playfair Display','Space Grotesk','JetBrains Mono'].map(font=><option key={font}>{font}</option>)}
        </select></label>
        <div className="grid grid-cols-2 gap-2">
          <NumericControl label="Tamaño" value={chosenCustom.fontSize??34} min={8} max={500} onChange={v=>num('fontSize',v)}/>
          <NumericControl label="Tracking" value={chosenCustom.letterSpacing??0} min={-20} max={80} step={.5} onChange={v=>updateCustom({letterSpacing:v})}/>
          <NumericControl label="Interlineado" value={chosenCustom.lineHeight??1.2} min={.6} max={3} step={.05} unit="×" onChange={v=>updateCustom({lineHeight:v})}/>
          <label><span className={cap}>Peso</span><select className={field} value={chosenCustom.fontWeight??700} onChange={e=>updateCustom({fontWeight:Number(e.target.value)})}>
            {[300,400,500,600,700,800,900].map(n=><option key={n} value={n}>{n}</option>)}
          </select></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={cap}>Alineación</span><select className={field} value={chosenCustom.textAlign??'left'} onChange={e=>updateCustom({textAlign:e.target.value as 'left'|'center'|'right'})}>
            <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
          </select></label>
          <label><span className={cap}>Caja</span><select className={field} value={chosenCustom.textTransform??'none'} onChange={e=>updateCustom({textTransform:e.target.value as NonNullable<GraphicLayer['textTransform']>})}>
            <option value="none">Normal</option><option value="uppercase">MAYÚSCULAS</option><option value="lowercase">minúsculas</option><option value="capitalize">Título</option>
          </select></label>
        </div>
      </section>}
      {chosenCustom?.kind==='image'&&<section className="rounded-xl border border-white/10 bg-[#0C0E13] p-3 space-y-2" aria-label="Tratamiento de imagen">
        <strong className="text-[10px] tracking-wider uppercase text-white">Imagen · Ajuste y recorte</strong>
        <div className="grid grid-cols-2 gap-2"><button className={`rounded-lg py-2 text-[11px] border ${(chosenCustom.imageFit??'contain')==='contain'?'border-[#FF6B00] bg-[#FF6B00]/15':'border-white/10'}`} onClick={()=>updateCustom({imageFit:'contain'})}>Contener</button>
        <button className={`rounded-lg py-2 text-[11px] border ${chosenCustom.imageFit==='cover'?'border-[#FF6B00] bg-[#FF6B00]/15':'border-white/10'}`} onClick={()=>updateCustom({imageFit:'cover'})}>Rellenar</button></div>
        <label><span className={cap}>Punto de enfoque</span><select className={field} value={chosenCustom.imagePosition??'center'} onChange={e=>updateCustom({imagePosition:e.target.value})}>
          <option value="center">Centro</option><option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
        </select></label>
      </section>}
      <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3" aria-label="Timeline individual de capa">
        <div className="flex justify-between items-center gap-2">
          <div className="flex gap-2 items-center"><Clock3 size={15} className="text-[#FF6B00]"/><span className="font-bold text-white">MOTION · CAPA</span></div>
          <button className="flex gap-1 items-center rounded-lg px-2 py-1 text-[#FF6B00] bg-[#FF6B00]/10" onClick={onReplay}><Play size={13}/> Probar</button>
        </div>
        <label><span className={cap}>Efecto de entrada</span>
          <select className={field} value={motion.effect} onChange={e=>changeMotion({effect:e.target.value as LayerEffect})}>
            <option value="none">Sin animación</option><option value="fade">Fundido</option>
            <option value="rise">Subir suavemente</option><option value="slide-left">Entrar de izquierda</option>
            <option value="slide-right">Entrar de derecha</option><option value="scale">Escalar</option><option value="pop">Pop / rebote sutil</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([['delayMs','Espera (ms)'],['entryMs','Entrada (ms)'],['holdMs','Permanencia (ms)'],['exitMs','Salida (ms)']] as const).map(([key,label])=><label key={key}>
            <span className={cap}>{label}</span>
            <input className={field} type="number" min="0" step="50" value={motion[key]} onChange={e=>changeMotion({[key]:Number(e.target.value)})}/>
          </label>)}
        </div>
        <label><span className={cap}>Curva de animación</span><select className={field} value={motion.easing} onChange={e=>changeMotion({easing:e.target.value as LayerMotion['easing']})}>
          <option value="cubic-bezier(0.16, 1, 0.3, 1)">Elegante / Apple</option>
          <option value="ease-out">Suave</option><option value="ease-in-out">Entrada + salida suave</option><option value="linear">Lineal</option>
        </select></label>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-slate-400"><span>Línea de tiempo</span><span>{(motion.delayMs+totalMs)/1000}s</span></div>
          <div className="flex h-3 overflow-hidden rounded-full bg-white/10" title="Tiempo de espera / entrada / permanencia / salida">
            <div className="bg-transparent" style={{flex:motion.delayMs}}/>
            <div className="bg-[#FF6B00]" style={{flex:motion.entryMs}}/>
            {motion.holdMs>0&&<div className="bg-emerald-600" style={{flex:motion.holdMs}}/>}
            {motion.holdMs>0&&<div className="bg-sky-500" style={{flex:motion.exitMs}}/>}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">Naranja = entrada · Verde = visible · Azul = salida. Permanencia 0 mantiene la capa hasta ocultar la fuente en OBS. Pulsa Probar para ver el resultado.</p>
        </div>
      </section>
      {(chosenCustom||chosenBuiltin)&&<div className="flex gap-2 flex-wrap">
        {chosenCustom&&<button className="rounded-lg p-2 bg-white/10 hover:bg-white/15 flex items-center gap-1" onClick={duplicate}><Copy size={13}/> Duplicar</button>}
        <button className="rounded-lg p-2 bg-white/10 hover:bg-white/15" onClick={()=>reorder(-1)}>Atrás</button>
        <button className="rounded-lg p-2 bg-white/10 hover:bg-white/15" onClick={()=>reorder(1)}>Adelante</button>
        {chosenCustom&&<button className="rounded-lg p-2 bg-rose-500/15 text-rose-200 flex items-center gap-1" onClick={remove}><Trash2 size={13}/> Borrar</button>}
      </div>}
      {(chosenCustom?.locked||override?.locked)&&<p className="text-[11px] text-amber-300">Bloqueada: edita desde el inspector, pero no es arrastrable.</p>}
      <button className="w-full text-slate-400 hover:text-white rounded-lg border border-white/10 py-2" onClick={()=>onSelect(null)}>Deseleccionar capa</button>
    </>}
  </div>;
};
