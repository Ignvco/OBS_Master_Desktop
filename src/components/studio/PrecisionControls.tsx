import React,{useEffect,useRef,useState} from 'react';
import {Minus,Plus,RotateCcw} from 'lucide-react';
import {clampDesignNumber,isHexColor} from '../../utils/creativeStyles';

const field='min-w-0 w-full bg-transparent text-white font-mono text-xs tabular-nums outline-none';
export const NumericControl:React.FC<{
  label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number;unit?:string;precision?:number;
}> = ({label,value,onChange,min=-100000,max=100000,step=1,unit='px',precision=2}) => {
  const [draft,setDraft]=useState(String(value));
  const [focused,setFocused]=useState(false);
  const scrubRef=useRef<{pointer:number;start:number;value:number;last:number}|null>(null);
  useEffect(()=>{if(!focused&&!scrubRef.current)setDraft(String(value));},[value,focused]);
  const adjust=(v:number)=>{
    const rounded=Number(clampDesignNumber(v,min,max).toFixed(precision));
    if(!Number.isFinite(rounded))return;
    setDraft(String(rounded));onChange(rounded);
  };
  const commit=()=>{const n=Number(draft.replace(',','.'));if(draft.trim()&&Number.isFinite(n))adjust(n);else setDraft(String(value));setFocused(false);};
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      <span role="button" tabIndex={0} title="Arrastra horizontalmente para ajustar" aria-label={`${label}. Arrastra horizontalmente para ajustar`}
        className="cursor-ew-resize hover:text-orange-300 select-none touch-none"
        onPointerDown={e=>{if(e.button!==0)return;scrubRef.current={pointer:e.pointerId,start:e.clientX,value,last:value};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{const s=scrubRef.current;if(!s||s.pointer!==e.pointerId)return;const multiplier=e.shiftKey?0.1:e.altKey?5:1;const next=clampDesignNumber(s.start==null?value:s.value+Math.round((e.clientX-s.start)/5)*step*multiplier,min,max);if(next!==s.last){s.last=next;adjust(next);}}}
        onPointerUp={e=>{scrubRef.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
        onPointerCancel={()=>{scrubRef.current=null;}}
      >{label} <span className="text-slate-600 normal-case">↔</span></span>
      <span className="text-slate-600 normal-case">{unit}</span>
    </div>
    <div className="flex items-center rounded-lg border border-white/10 bg-[#11151d] focus-within:border-orange-400/60 overflow-hidden h-9">
      <button type="button" title={`Reducir ${label}`} className="p-2 text-slate-500 hover:text-white hover:bg-white/10" onClick={()=>adjust(value-step)}><Minus size={11}/></button>
      <input type="text" inputMode="decimal" aria-label={label} className={`${field} text-center`} value={draft}
        onFocus={()=>setFocused(true)} onChange={e=>setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}if(e.key==='Escape'){setDraft(String(value));e.currentTarget.blur();}}}/>
      <button type="button" title={`Aumentar ${label}`} className="p-2 text-slate-500 hover:text-white hover:bg-white/10" onClick={()=>adjust(value+step)}><Plus size={11}/></button>
    </div>
  </div>;
};
const swatches=['#FF6B00','#F04E37','#FFC857','#FFFFFF','#08090A','#1C1D21','#794BFF','#5DD5CF'];
export const ColorControl:React.FC<{label:string;value:string;onChange:(value:string)=>void;transparent?:boolean}> = ({label,value,onChange,transparent=false})=>{
  const [draft,setDraft]=useState(value);
  const [editing,setEditing]=useState(false);
  useEffect(()=>{if(!editing)setDraft(value);},[value,editing]);
  const valid=isHexColor(value);
  const commit=()=>{const val=draft.trim();if(isHexColor(val)||transparent&&val==='transparent')onChange(val);else setDraft(value);setEditing(false);};
  return <div className="space-y-1.5">
    <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</span>
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#11151d] h-10 p-1.5">
      <input type="color" aria-label={`Selector de color: ${label}`} title="Seleccionar color" value={valid?value:'#FF6B00'} onChange={e=>{setDraft(e.target.value);onChange(e.target.value);}} className="h-7 w-9 rounded cursor-pointer bg-transparent border-0 p-0"/>
      <input type="text" spellCheck={false} aria-label={`HEX de ${label}`} value={draft} className={`${field} uppercase`} onFocus={()=>setEditing(true)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setDraft(value);e.currentTarget.blur();}}}/>
      {transparent && <button type="button" title="Sin fondo" onClick={()=>onChange('transparent')} className="text-slate-500 hover:text-white p-1"><RotateCcw size={13}/></button>}
    </div>
    <div className="flex flex-wrap gap-1" aria-label={`Paleta rápida de ${label}`}>
      {swatches.map(c=><button type="button" key={c} title={c} aria-label={`Aplicar ${c}`} onClick={()=>onChange(c)}
        className={`rounded-full w-4 h-4 border border-white/30 ${value.toUpperCase()===c?'ring-2 ring-offset-1 ring-offset-[#171719] ring-orange-400':''}`} style={{background:c}}/>)}
    </div>
  </div>;
};
