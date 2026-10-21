import React from 'react';
import type {GeometrySettings} from '../../types';
import {ColorControl,NumericControl} from './PrecisionControls';

const field='w-full rounded-lg border border-white/10 bg-[#11151d] px-2 py-2 text-[11px] text-white focus:outline-none focus:border-[#FF6B00]';
export const ComponentGeometryInspector:React.FC<{geometry:GeometrySettings;onChange:(patch:Partial<GeometrySettings>)=>void}> = ({geometry:g,onChange})=>{
  const set=(key:keyof GeometrySettings,value:number|string)=>onChange({[key]:value});
  return <div className="studio-geometry space-y-3 text-xs min-w-0">
    <section className="studio-tool-section space-y-3">
      <div className="studio-tool-section-title"><strong>01 · Transformación</strong><span>1920 × 1080</span></div>
      <p className="text-[10px] text-slate-400">Pulsa ±, escribe una cifra o arrastra el título de cada parámetro ↔.</p>
      <div className="grid grid-cols-2 gap-3">
        <NumericControl label="X" value={g.x} min={-1920} max={3840} onChange={v=>set('x',v)}/>
        <NumericControl label="Y" value={g.y} min={-1080} max={2160} onChange={v=>set('y',v)}/>
        <NumericControl label="Ancho" value={g.width} min={16} max={3840} onChange={v=>set('width',v)}/>
        <NumericControl label="Alto" value={g.height} min={16} max={2160} onChange={v=>set('height',v)}/>
        <NumericControl label="Escala" value={g.scale} min={.1} max={5} step={.1} precision={2} unit="×" onChange={v=>set('scale',v)}/>
        <NumericControl label="Rotación" value={g.rotation} min={-360} max={360} step={1} unit="°" onChange={v=>set('rotation',v)}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-2" onClick={()=>onChange({x:Math.round((1920-g.width*g.scale)/2)})}>Centrar horizontal</button>
        <button type="button" className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-2" onClick={()=>onChange({y:Math.round((1080-g.height*g.scale)/2)})}>Centrar vertical</button>
      </div>
    </section>
    <details className="studio-tool-section studio-tool-collapsible">
      <summary>02 · Superficie, color y profundidad <span aria-hidden="true">⌄</span></summary>
      <div className="space-y-3 pt-3">
      <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-2.5 space-y-2">
        <label className="flex items-start gap-2 text-[11px] text-slate-200 cursor-pointer">
          <input type="checkbox" checked={!!g.flatMode} onChange={e=>onChange({flatMode:e.target.checked})} className="accent-orange-500 mt-0.5"/>
          <span><strong className="text-white block">Sin sombras ni resplandores</strong>Desactiva todas las sombras, incluso las integradas en plantillas y textos. No elimina rellenos ni bordes.</span>
        </label>
        <label className="flex items-start gap-2 text-[11px] text-slate-200 cursor-pointer">
          <input type="checkbox" checked={!!g.hideBorders} onChange={e=>onChange({hideBorders:e.target.checked})} className="accent-orange-500 mt-0.5"/>
          <span><strong className="text-white block">Sin bordes ni divisores</strong>Elimina contornos de la gráfica; no afecta las guías del editor.</span>
        </label>
      </div>
      <ColorControl label="Fondo" value={g.backgroundColor} onChange={v=>set('backgroundColor',v)} transparent/>
      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
        <input type="checkbox" checked={!!g.backgroundGradient?.enabled} onChange={e=>onChange({backgroundGradient:{enabled:e.target.checked,type:g.backgroundGradient?.type??'linear',from:g.backgroundGradient?.from??'#151822',to:g.backgroundGradient?.to??'#08090A',angle:g.backgroundGradient?.angle??135}})} className="accent-orange-500"/>
        Activar degradado de fondo
      </label>
      {g.backgroundGradient?.enabled&&<>
        <label className="block"><span className="text-[10px] text-slate-400">Tipo de degradado</span>
          <select className={field} value={g.backgroundGradient.type} onChange={e=>onChange({backgroundGradient:{...g.backgroundGradient!,type:e.target.value as 'linear'|'radial'}})}>
            <option value="linear">Lineal</option><option value="radial">Radial</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ColorControl label="Color inicial" value={g.backgroundGradient.from} onChange={v=>onChange({backgroundGradient:{...g.backgroundGradient!,from:v}})}/>
          <ColorControl label="Color final" value={g.backgroundGradient.to} onChange={v=>onChange({backgroundGradient:{...g.backgroundGradient!,to:v}})}/>
        </div>
        {g.backgroundGradient.type==='linear'&&<NumericControl label="Dirección" value={g.backgroundGradient.angle} unit="°" min={0} max={360} step={5} onChange={v=>onChange({backgroundGradient:{...g.backgroundGradient!,angle:v}})}/>}
      </>}
      <div className="grid grid-cols-2 gap-3">
        <NumericControl label="Radio" value={g.borderRadius} min={0} max={800} onChange={v=>set('borderRadius',v)}/>
        <NumericControl label="Borde" value={g.borderWidth} min={0} max={40} onChange={v=>set('borderWidth',v)}/>
      </div>
      {g.borderWidth>0&&<ColorControl label="Color de borde" value={g.borderColor} onChange={v=>set('borderColor',v)}/>}
      <NumericControl label="Opacidad" value={Math.round(g.opacity*100)} unit="%" step={5} min={0} max={100} onChange={v=>set('opacity',v/100)}/>
      <NumericControl label="Padding" value={g.padding} min={0} max={450} onChange={v=>set('padding',v)}/>
      <label className="block"><span className="text-[10px] text-slate-400">Sombra del componente</span>
        <select className={field} value={g.boxShadow==='none'?'none':g.boxShadow.includes('45px')?'lifted':g.boxShadow.includes('35px')?'glow':'soft'}
          onChange={e=>onChange({boxShadow:({none:'none',soft:'0 10px 25px rgba(0,0,0,.3)',lifted:'0 16px 45px rgba(0,0,0,.55)',glow:'0 0 35px rgba(255,107,0,.45)'})[e.target.value as 'none'|'soft'|'lifted'|'glow']})}>
          <option value="none">Sin sombra</option><option value="soft">Sombra suave</option><option value="lifted">Elevada</option><option value="glow">Resplandor naranja</option>
        </select>
      </label>
      </div>
    </details>
    <p className="text-[10px] leading-relaxed text-slate-500">Estos ajustes modifican el contenedor completo. Para crear máscaras y efectos únicos en cada objeto, selecciona una capa y abre «Capas».</p>
  </div>;
};
