import React from 'react';
import {ArrowDown,ArrowUp,Plus,Trash2,ImagePlus} from 'lucide-react';
import {uploadLogo} from '../../services/logoUpload';
import {normalizeSocialNetworks, SOCIAL_LABELS, SOCIAL_PLATFORMS} from '../../utils/socialPill';
import type {SocialNetwork, SocialPlatform, SocialPillContent} from '../../utils/socialPill';

const input='w-full rounded-lg bg-slate-900 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500';
export const SocialNetworksEditor:React.FC<{content:SocialPillContent;onChange:(patch:Partial<SocialPillContent>)=>void}> = ({content,onChange})=>{
  const networks=normalizeSocialNetworks(content.networks);
  const setNetworks=(next:SocialNetwork[])=>onChange({networks:next,activeId:next.some(n=>n.id===content.activeId)?content.activeId:next[0]?.id});
  const edit=(id:string,patch:Partial<SocialNetwork>)=>setNetworks(networks.map(n=>n.id===id?{...n,...patch}:n));
  const move=(id:string,delta:number)=>{
    const index=networks.findIndex(n=>n.id===id);const other=index+delta;
    if(index<0||other<0||other>=networks.length)return;
    const next=[...networks];[next[index],next[other]]=[next[other],next[index]];setNetworks(next);
  };
  return <section className="rounded-xl border border-orange-500/20 bg-black/25 p-3 space-y-3">
    <div className="space-y-1"><h3 className="text-white text-xs font-bold">REDES · SOCIAL PILL</h3>
      <p className="text-[11px] text-slate-400">Cada red es editable y puede tener su propio icono. En rotación, editor y OBS utilizan el mismo reloj.</p></div>
    {Array.isArray(content.networks)&&content.networks.some(x=>!x||typeof x!=='object'||Array.isArray(x))&&
      <p role="alert" className="text-amber-300 text-[11px]">Se detectaron redes antiguas con formato inválido. Modifica o añade una red para guardar la estructura reparada.</p>}
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-300">Comportamiento
        <select className={input} value={content.rotationMode??(Number(content.rotationIntervalSeconds)>0?'rotate':'fixed')} onChange={e=>onChange({rotationMode:e.target.value as 'fixed'|'rotate',rotationEpochMs:Date.now()})}>
          <option value="fixed">Red fija</option><option value="rotate">Rotar redes</option>
        </select>
      </label>
      {(content.rotationMode??(Number(content.rotationIntervalSeconds)>0?'rotate':'fixed'))==='fixed'?<label className="text-xs text-slate-300">Red en pantalla
        <select className={input} value={networks.find(n=>n.id===content.activeId)?.id??networks.find(n=>n.platform===content.activeNetwork)?.id??networks[0].id} onChange={e=>onChange({activeId:e.target.value})}>
          {networks.map(n=><option key={n.id} value={n.id}>{n.label||n.platform}</option>)}
        </select>
      </label>:<label className="text-xs text-slate-300">Segundos por red
        <input className={input} type="number" min={2} max={120} value={content.rotationIntervalSeconds??6} onChange={e=>onChange({rotationIntervalSeconds:Math.max(2,Math.min(120,Number(e.target.value)||6))})}/>
      </label>}
    </div>
    <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={content.showBadge!==false} onChange={e=>onChange({showBadge:e.target.checked})}/> Mostrar distintivo</label>
    {content.showBadge!==false&&<label className="text-xs text-slate-300">Texto del distintivo
      <input className={input} value={content.badgeText??'FOLLOW'} onChange={e=>onChange({badgeText:e.target.value})}/>
    </label>}
    <div className="space-y-2">{networks.map((n,index)=><div key={n.id} className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5 space-y-2">
      <div className="flex items-center gap-1"><span className="text-[11px] text-slate-200 font-semibold flex-1 truncate">{index+1}. {n.label||SOCIAL_LABELS[n.platform]}</span>
        <button title="Subir" type="button" disabled={index===0} onClick={()=>move(n.id,-1)} className="p-1.5 disabled:opacity-25"><ArrowUp size={13}/></button>
        <button title="Bajar" type="button" disabled={index===networks.length-1} onClick={()=>move(n.id,1)} className="p-1.5 disabled:opacity-25"><ArrowDown size={13}/></button>
        <button title="Eliminar" type="button" disabled={networks.length===1} onClick={()=>setNetworks(networks.filter(x=>x.id!==n.id))} className="p-1.5 text-rose-300 disabled:opacity-25"><Trash2 size={13}/></button>
      </div>
      <select aria-label={`Plataforma ${index+1}`} className={input} value={n.platform} onChange={e=>{const platform=e.target.value as SocialPlatform;edit(n.id,{platform,label:SOCIAL_LABELS[platform]});}}>
        {SOCIAL_PLATFORMS.map(p=><option key={p} value={p}>{SOCIAL_LABELS[p]}</option>)}
      </select>
      <input aria-label={`Etiqueta ${index+1}`} className={input} placeholder="Nombre de la red" value={n.label} onChange={e=>edit(n.id,{label:e.target.value})}/>
      <input aria-label={`Cuenta ${index+1}`} className={input} placeholder="@usuario / URL" value={n.handle} onChange={e=>edit(n.id,{handle:e.target.value})}/>
      <label className="text-[11px] text-slate-400 flex items-center gap-2 cursor-pointer"><ImagePlus size={14}/>{n.iconAssetUrl?'Cambiar icono':'Usar imagen como icono'}
        <input aria-label={`Icono ${index+1}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const url=await uploadLogo(file);edit(n.id,{iconAssetUrl:url});}catch(error){window.alert(error instanceof Error?error.message:'No se pudo subir la imagen');}}}/>
      </label>
      {n.iconAssetUrl&&<button className="text-[11px] text-orange-300" type="button" onClick={()=>edit(n.id,{iconAssetUrl:undefined})}>Quitar imagen, usar icono de red</button>}
    </div>)}</div>
    <button type="button" disabled={networks.length>=12} onClick={()=>setNetworks([...networks,{id:`network-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,platform:'instagram',label:'Instagram',handle:''}])}
      className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-100 text-xs disabled:opacity-30"><Plus size={14}/> Añadir red social</button>
  </section>;
};
