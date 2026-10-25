import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Copy, Edit3,
  Plus, Save, ShieldAlert, Trash2, X
} from 'lucide-react';
import type { ComponentType, EditorialComponentConfig, CustomComponentRegistry, EpisodeData, OBSStatus, RundownBlock } from '../../types';
import { formatTime } from '../../utils/animationEngine';
import {
  getStartTime, isTime, MANUAL_CHECKS, markBlockStatus, missingGraphics,
  moveBlock, retimeRundown, updateRundown, validateRundown
} from '../../utils/preparation';

interface Props {
  episode: EpisodeData;
  components: Record<ComponentType, EditorialComponentConfig>;
  customComponents:CustomComponentRegistry;
  obsStatus: OBSStatus;
  onUpdateEpisode: (updated: EpisodeData) => void;
  onUpdateComponent: (config: EditorialComponentConfig) => void;
  onSetPreviewScene: (sceneName: string) => Promise<boolean>;
  onSetProgramScene: (sceneName: string) => Promise<boolean>;
}

type Section = 'questions'|'phrases'|'tickerNews';
type EditorialDraft = Pick<EpisodeData, 'questions'|'phrases'|'tickerNews'|'scriptures'|'quotes'>;
const cloneEditorial = (episode:EpisodeData):EditorialDraft => ({
  questions:[...episode.questions], phrases:[...episode.phrases], tickerNews:[...episode.tickerNews],
  scriptures:episode.scriptures.map(s=>({...s})), quotes:episode.quotes.map(q=>({...q})),
});
const CARD = 'atem-module p-3.5';
const FIELD = 'w-full rounded glass-input px-3 py-1.5 text-xs text-white font-mono outline-none';
const BTN = 'atem-btn px-2.5 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed';
const ORANGE = 'atem-btn atem-btn-pvw px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-35 disabled:cursor-not-allowed';
const TYPES:ComponentType[] = ['banner','lower-third','chapter','section','question','quote','scripture','social','social-pill','logo-bug','ticker','editorial','waiting','break','outro'];
const newId = () => `block-${crypto.randomUUID()}`;

export const PreflightRundownSpace:React.FC<Props> = ({
  episode, components, customComponents, obsStatus, onUpdateEpisode, onUpdateComponent, onSetPreviewScene, onSetProgramScene,
}) => {
  const [tab,setTab]=useState<'rundown'|'diagnostics'|'prompts'>('rundown');
  const [editing,setEditing]=useState<RundownBlock|null>(null);
  const [editEditorial,setEditEditorial]=useState(false);
  const [draft,setDraft]=useState<EditorialDraft>(()=>cloneEditorial(episode));
  const [pending,setPending]=useState(false);
  const [feedback,setFeedback]=useState('Preparación es una guía operativa: ninguna gráfica se activará automáticamente.');
  const busy=useRef(false);
  useEffect(()=> { setDraft(cloneEditorial(episode)); setEditEditorial(false); },[episode.id]);

  const start = getStartTime(episode);
  const ordered = retimeRundown(episode.rundown, start);
  const totalDuration=episode.rundown.reduce((a,b)=>a+(Number.isFinite(b.durationSeconds)?b.durationSeconds:0),0);
  const liveConnected=obsStatus.connected&&!obsStatus.isSimulated;
  const sceneNames=obsStatus.scenes.map(s=>s.name);
  const errors=validateRundown(ordered,sceneNames,liveConnected);
  const unknownGraphics=missingGraphics(ordered,components);
  const missingCustom=ordered.flatMap(block=>(block.customGraphicIds||[]).filter(id=>!customComponents[id]));
  const allSources=obsStatus.scenes.flatMap(s=>s.sources);
  const cameraSources=allSources.filter(s=>/emeet|cam(era)?[_ -]|captura de v[ií]deo/i.test(s.name)||/dshow_input|video_capture/i.test(s.type));
  const introSources=allSources.filter(s=>/intro|apertura/i.test(s.name)||/ffmpeg_source|vlc_source/i.test(s.type));
  const requiresIntro=ordered.some(b=>b.introVideoAttached);
  const manualChecks=episode.preparation?.manualChecks || {};
  const automaticChecks=[
    {id:'obs',title:'OBS WebSocket conectado',passed:liveConnected,detail:obsStatus.isSimulated?'Modo simulado: no certificado':liveConnected?`Confirmado · ${obsStatus.latencyMs} ms`:'Desconectado'},
    {id:'virtualcam',title:'Cámara virtual activa',passed:liveConnected&&obsStatus.virtualCamActive,detail:obsStatus.virtualCamActive?'OBS informa salida activa':'Activar y comprobar en StreamYard'},
    {id:'rundown',title:'Escaleta compatible con escenas reales',passed:liveConnected&&errors.length===0&&unknownGraphics.length===0&&missingCustom.length===0,detail:!liveConnected?'Conectar OBS para validar escenas':errors.length?errors[0]:unknownGraphics.length?`Gráficas no configuradas: ${unknownGraphics.join(', ')}`:missingCustom.length?`Gráficas personalizadas ausentes: ${missingCustom.join(', ')}`:`${ordered.length} bloques con escenas válidas`},
  ];
  const manualRelevant=MANUAL_CHECKS.filter(c=>c.id!=='introPlayback'||requiresIntro);
  const ready=automaticChecks.every(c=>c.passed)&&manualRelevant.every(c=>manualChecks[c.id]);

  const saveBlocks=(blocks:RundownBlock[], time=start)=>onUpdateEpisode(updateRundown(episode,blocks,time));
  const addBlock=()=>{
    const value:RundownBlock={id:newId(),order:ordered.length+1,timePlanned:'00:00:00',title:'Nuevo segmento',presenter:'',durationSeconds:300,obsSceneTarget:'',graphicComponents:[],notes:'',status:'pending'};
    setEditing(value);
  };
  const saveBlock=(event:React.FormEvent)=>{
    event.preventDefault(); if(!editing)return;
    const nextTitle=editing.title.trim();
    if(!nextTitle||!Number.isFinite(editing.durationSeconds)||editing.durationSeconds<=0||editing.durationSeconds>14400){setFeedback('Revisa título y duración (1 a 14.400 segundos).');return;}
    if(!editing.obsSceneTarget.trim()){setFeedback('Selecciona la escena de OBS; no se aceptan escenas vacías.');return;}
    const exists=episode.rundown.some(b=>b.id===editing.id);
    saveBlocks(exists?episode.rundown.map(b=>b.id===editing.id?{...editing,title:nextTitle}:b):[...episode.rundown,{...editing,title:nextTitle}]);
    setEditing(null); setFeedback(`Bloque «${nextTitle}» guardado. Horarios recalculados.`);
  };
  const changeStatus=(id:string,status:RundownBlock['status'])=>saveBlocks(markBlockStatus(episode.rundown,id,status));
  const goPreview=async(block:RundownBlock)=>{
    if(busy.current)return;
    if(!liveConnected||!obsStatus.studioMode||!sceneNames.includes(block.obsSceneTarget)){setFeedback('No se puede preparar Preview: conecta OBS, habilita Modo Estudio y verifica la escena.');return;}
    busy.current=true;setPending(true);
    try {if(await onSetPreviewScene(block.obsSceneTarget)){
      saveBlocks(markBlockStatus(episode.rundown,block.id,'preview'));
      setFeedback(`Escena «${block.obsSceneTarget}» preparada en Preview. Ninguna gráfica se ha activado.`);
    } else setFeedback('OBS no confirmó el cambio de Preview.');}
    finally {busy.current=false;setPending(false);}
  };
  const goProgram=async(block:RundownBlock)=>{
    if(busy.current||!liveConnected||!sceneNames.includes(block.obsSceneTarget))return;
    if(!window.confirm(`¿Enviar «${block.obsSceneTarget}» a PROGRAM?\nEsto cambiará la señal real de OBS. Las gráficas previstas NO se activarán automáticamente.`))return;
    busy.current=true;setPending(true);
    try{if(await onSetProgramScene(block.obsSceneTarget)){
      saveBlocks(markBlockStatus(episode.rundown,block.id,'on-air'));
      setFeedback(`Escena «${block.obsSceneTarget}» confirmada por OBS. Bloque ${block.order} marcado al aire.`);
    }else setFeedback('OBS no confirmó el cambio o Modo Protegido impidió la operación.');}
    finally{busy.current=false;setPending(false);}
  };
  const applyEditorial=(type:ComponentType,content:Record<string,unknown>,label:string)=>{
    const graphic=components[type]; if(!graphic)return;
    if(graphic.visibleInOBS&&!window.confirm(`«${graphic.name}» está visible en OBS. Cambiar el contenido puede afectar la emisión. ¿Actualizarlo?`))return;
    onUpdateComponent({...graphic,content:{...graphic.content,...content},updatedAt:new Date().toISOString()});
    setFeedback(`${label} copiado al componente «${graphic.name}». No se alteró su visibilidad.`);
  };
  const updateSimple=(key:Section,index:number,value:string)=>setDraft(d=>({...d,[key]:d[key].map((v,i)=>i===index?value:v)}));
  const editArray=(key:Section,action:'add'|'remove',index=0)=>setDraft(d=>({...d,[key]:action==='add'?[...d[key],'']:d[key].filter((_,i)=>i!==index)}));
  const commitEditorial=()=>{
    onUpdateEpisode({...episode,questions:draft.questions.filter(x=>x.trim()),phrases:draft.phrases.filter(x=>x.trim()),tickerNews:draft.tickerNews.filter(x=>x.trim()),scriptures:draft.scriptures.filter(x=>x.reference.trim()||x.text.trim()),quotes:draft.quotes.filter(x=>x.quote.trim())});
    setEditEditorial(false);setFeedback('Guía editorial guardada en el episodio activo y Biblioteca. Las gráficas solo cambian mediante «Enviar a gráfica».');
  };
  const updateManual=(id:typeof MANUAL_CHECKS[number]['id'],checked:boolean)=>{
    onUpdateEpisode({...episode,preparation:{...episode.preparation,startTime:start,manualChecks:{...manualChecks,[id]:checked}}});
  };

  return <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 w-full text-slate-100 animate-in fade-in duration-150 select-none">
    <div className="max-w-[1640px] mx-auto space-y-3.5">
      <header className="atem-module px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#06080b] border border-[#252b37] text-[10px] font-mono font-black text-sky-400 uppercase tracking-wider">
              PREFLIGHT & RUNDOWN
            </span>
            <h1 className="text-base font-black uppercase tracking-wider text-white">Preparación de Emisión</h1>
          </div>
          <p className="text-xs font-mono text-slate-400">EP #{episode.number} · {episode.title} — Planificar bloques no activa gráficas al aire.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`rounded px-2.5 py-1.5 text-[11px] font-mono font-black border ${ready?'text-emerald-300 border-emerald-500/40 bg-emerald-950/40':'text-amber-300 border-amber-500/40 bg-amber-950/40'}`}>
            {ready ? '● PRE-VUELO VERIFICADO' : '▲ VERIFICACIONES PENDIENTES'}
          </span>
          <div className="atem-well flex items-center gap-1">
            {([['rundown','Escaleta Técnica'],['diagnostics','Matriz Pre-vuelo'],['prompts','Guía Editorial']] as const).map(([id,title])=><button key={id} onClick={()=>setTab(id)} className={`rounded-[3px] px-3 py-1.5 text-xs font-bold transition-colors ${tab===id?'bg-[#232a38] text-white border border-sky-400/60':'text-slate-400 hover:text-white'}`}>{title}</button>)}
          </div>
        </div>
      </header>
      <div role="status" className="atem-readout px-3.5 py-2 text-xs text-slate-300">{feedback}</div>

      {tab==='rundown'&&<div className="space-y-3.5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={CARD}><div className="atem-label">COMIENZO PLANIFICADO</div><input aria-label="Hora de comienzo" type="time" step="60" className={`${FIELD} mt-2`} value={start} onChange={e=>{if(isTime(e.target.value))saveBlocks(episode.rundown,e.target.value)}}/><p className="text-[10px] text-slate-500 mt-1.5">Recalcula timecodes de la escaleta</p></div>
          <div className={CARD}><div className="atem-label">DURACIÓN PREVISTA</div><div className="text-2xl font-mono font-black text-white mt-2">{formatTime(totalDuration)}</div><p className="text-[10px] text-slate-500 mt-1.5">Tiempo acumulado de segmentos</p></div>
          <div className={CARD}><div className="atem-label">SEGMENTOS EN ESCALETA</div><div className="text-2xl font-mono font-black text-white mt-2">{ordered.length}</div><p className="text-[10px] text-slate-500 mt-1.5">Bloques ordenables con escena OBS</p></div>
          <div className={CARD}><div className="atem-label">INTEGRIDAD DE ESCENAS</div><div className={`text-2xl font-mono font-black mt-2 ${errors.length?'text-amber-300':'text-emerald-400'}`}>{errors.length?`${errors.length} AVISOS`:'OK · VÁLIDAS'}</div><p className="text-[10px] text-slate-500 mt-1.5">{liveConnected?'Comprobadas contra OBS':'Conecta OBS real para validar'}</p></div>
        </div>
        {errors.length>0&&<div className="rounded border border-amber-500/40 bg-amber-950/30 px-3.5 py-2.5 text-xs font-mono text-amber-200"><strong>REVISAR ESCALETA:</strong> {errors.slice(0,3).join(' · ')}{errors.length>3?'…':''}</div>}
        <div className="flex flex-wrap gap-4 text-xs atem-readout px-3.5 py-2">
          <span className="text-slate-400">OBS PROGRAM: <strong className="text-red-400">{liveConnected?(obsStatus.currentProgramScene||'Sin escena'):'No conectado'}</strong></span>
          <span className="text-slate-400">OBS PREVIEW: <strong className="text-emerald-400">{liveConnected?(obsStatus.currentPreviewScene||'Sin escena'):'No conectado'}</strong></span>
          <span className="text-slate-500">Coincidencia de escena no significa que un bloque se esté ejecutando.</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-black uppercase tracking-wider text-white">Secuencia de Segmentos del Programa</h2><p className="text-xs text-slate-400">Cada segmento prepara una escena OBS en Preview o Program. Las gráficas listadas son referencia de guion.</p></div>
          <div className="flex gap-2"><button className={BTN} onClick={()=>{if(window.confirm('¿Reiniciar solamente el progreso de los bloques? No modifica escenas ni diseños.'))saveBlocks(episode.rundown.map(b=>({...b,status:'pending' as const})));}}>Reiniciar progreso</button><button className={ORANGE} onClick={addBlock}><Plus className="w-3.5 h-3.5 inline mr-1"/>Añadir bloque</button></div>
        </div>
        <div className="space-y-2">{ordered.map((block,index)=>{
          const validScene=liveConnected&&sceneNames.includes(block.obsSceneTarget);
          return <div key={block.id} className="atem-module p-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded bg-[#06080b] border border-[#252b37] text-sky-400 flex items-center justify-center font-mono font-black text-xs shrink-0">
                  {String(index+1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-white">{block.title}</div>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{block.presenter||'Sin conductor asignado'} · TC {block.timePlanned.slice(0,5)} · DUR {formatTime(block.durationSeconds)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">{(block.graphicComponents||[]).map(type=><span key={type} className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#262c38] bg-[#06080b] text-slate-300">{components[type]?.name||type}</span>)}{(block.customGraphicIds||[]).map(id=><span key={id} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${customComponents[id]?'border-sky-500/35 text-sky-200 bg-sky-950/30':'border-red-500/40 text-red-300 bg-red-950/30'}`}>{customComponents[id]?.name||`Falta gráfica: ${id}`}</span>)}{block.introVideoAttached&&<span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/35 text-amber-300 bg-amber-950/30">INTRO VIDEO · VERIFICAR</span>}</div>
                  {block.notes&&<p className="mt-1.5 text-xs text-slate-400 whitespace-pre-wrap">{block.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap font-mono">
                <span className={`text-[10px] font-black rounded px-2 py-0.5 border ${block.status==='on-air'?'bg-red-600 text-white border-red-400':block.status==='completed'?'bg-emerald-950/50 text-emerald-300 border-emerald-500/40':block.status==='preview'?'bg-sky-950/50 text-sky-300 border-sky-400/40':'bg-[#06080b] text-slate-400 border-[#252b37]'}`}>
                  {block.status==='on-air'?'EN EMISIÓN':block.status==='completed'?'COMPLETADO':block.status==='preview'?'EN PREVIEW':'PENDIENTE'}
                </span>
                <span className={`text-[10px] font-bold ${validScene?'text-emerald-400':'text-amber-300'}`}>{liveConnected?(validScene?'ESCENA OK':'ESCENA NO DETECTADA'):'SIN VERIFICAR'}</span>
                {liveConnected&&obsStatus.currentProgramScene===block.obsSceneTarget&&<span className="text-[10px] font-bold text-red-400">● EN PROGRAM</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1f2532] pt-2">
              <span className="text-xs text-slate-300 mr-auto font-mono px-2 py-0.5 rounded bg-[#06080b] border border-[#222834]">ESCENA: {block.obsSceneTarget||'Sin escena asignada'}</span>
              <button disabled={pending||index===0} title="Subir bloque" className={BTN} onClick={()=>saveBlocks(moveBlock(episode.rundown,block.id,-1))}><ArrowUp className="w-3.5 h-3.5"/></button>
              <button disabled={pending||index===ordered.length-1} title="Bajar bloque" className={BTN} onClick={()=>saveBlocks(moveBlock(episode.rundown,block.id,1))}><ArrowDown className="w-3.5 h-3.5"/></button>
              <button disabled={pending} className={BTN} onClick={()=>setEditing(block)}><Edit3 className="w-3.5 h-3.5 inline mr-1"/>Editar</button>
              <button disabled={pending} className={BTN} title="Duplicar" onClick={()=>saveBlocks([...episode.rundown.slice(0,index+1),{...block,id:newId(),status:'pending'},...episode.rundown.slice(index+1)])}><Copy className="w-3.5 h-3.5"/></button>
              <button disabled={pending} className={BTN} title="Eliminar" onClick={()=>{if(window.confirm(`¿Eliminar «${block.title}» de la escaleta?`))saveBlocks(episode.rundown.filter(b=>b.id!==block.id))}}><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
              <button disabled={pending||!validScene||!obsStatus.studioMode} title="Requiere conexión OBS y Modo Estudio" className="atem-btn atem-btn-pvw px-3 py-1.5 text-xs font-bold disabled:opacity-35" onClick={()=>void goPreview(block)}>Preview</button>
              <button disabled={pending||!validScene} title="Acción real: requiere confirmación y Modo Protegido desactivado" className="atem-btn atem-btn-pgm px-3 py-1.5 text-xs font-bold disabled:opacity-35" onClick={()=>void goProgram(block)}>Enviar a Program</button>
              <button className={BTN} onClick={()=>changeStatus(block.id,block.status==='completed'?'pending':'completed')}>{block.status==='completed'?'Reabrir':'Completar'}</button>
            </div>
          </div>;
        })}</div>
      </div>}

      {tab==='diagnostics'&&<div className="space-y-4">
        <div className={`${CARD} space-y-1.5`}><div className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-sky-400"/><h2 className="atem-label text-white">MATRIZ DE VERIFICACIÓN TÉCNICA PRE-VUELO</h2></div><p className="text-xs text-slate-400">Los estados de OBS WebSocket son automáticos. Señal de cámara, reproducción de video, audio externo y StreamYard requieren confirmación humana.</p></div>
        <div className="grid md:grid-cols-3 gap-3">{automaticChecks.map(c=><div key={c.id} className={CARD}><div className="flex gap-2.5 items-start">{c.passed?<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"/>:<AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"/>}<div><div className="text-xs font-bold text-white uppercase tracking-wider">{c.title}</div><p className="text-xs font-mono text-slate-400 mt-1">{c.detail}</p></div></div></div>)}</div>
        <div className={CARD}><div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-amber-400"/><h3 className="atem-label text-white">CHECKLIST DE OPERADOR POR EPISODIO</h3></div><div className="grid md:grid-cols-2 gap-2.5">{manualRelevant.map(c=><label key={c.id} className="flex gap-3 items-start rounded border border-[#252b37] bg-[#07090c] p-3 cursor-pointer hover:border-sky-400/50"><input type="checkbox" checked={!!manualChecks[c.id]} onChange={e=>updateManual(c.id,e.target.checked)} className="mt-0.5 accent-sky-400"/><span><span className="block text-xs font-bold text-white">{c.title}</span><span className="block text-[11px] text-slate-400 mt-0.5">{c.detail}</span></span></label>)}</div><p className="mt-2.5 text-[11px] font-mono text-slate-500">Estos controles se guardan en el episodio activo y se reinician al crear un nuevo capítulo.</p></div>
        <div className={CARD}><h3 className="atem-label text-white mb-2">FUENTES DETECTADAS EN OBS STUDIO (SOLO TELEMETRÍA)</h3><p className="text-xs font-mono text-slate-300">FUENTES DE CÁMARA: <span className="text-white">{cameraSources.length?cameraSources.map(s=>s.name).join(', '):'ninguna'}</span></p><p className="text-xs font-mono text-slate-300 mt-1.5">FUENTES MULTIMEDIA / INTRO: <span className="text-white">{introSources.length?introSources.map(s=>s.name).join(', '):'ninguna'}</span></p><p className="text-[11px] text-slate-500 mt-2">La presencia de una fuente no certifica imagen ni audio. Verifica en el monitor de OBS Studio.</p></div>
      </div>}

      {tab==='prompts'&&<div className="space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center"><div><h2 className="text-sm font-black uppercase tracking-wider text-white">Guía Editorial del Episodio</h2><p className="text-xs text-slate-400">Textos preparados en el episodio. Solo actualizan el borrador de una gráfica cuando pulsas «Enviar a gráfica».</p></div><button className={ORANGE} onClick={()=>{setDraft(cloneEditorial(episode));setEditEditorial(true)}}><Edit3 className="w-3.5 h-3.5 inline mr-1"/>Editar guía</button></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className={CARD}><h3 className="atem-label text-white mb-2.5">PREGUNTAS AL PÚBLICO</h3><div className="space-y-2">{episode.questions.map((q,i)=><div key={i} className="atem-readout p-2.5 text-xs text-slate-200 space-y-2"><p className="font-sans">{q}</p><button className={BTN} onClick={()=>applyEditorial('question',{question:q},'Pregunta')}>Enviar a gráfica Pregunta</button></div>)}</div></div>
          <div className={CARD}><h3 className="atem-label text-white mb-2.5">FRASES Y TITULARES</h3><div className="space-y-2">{episode.phrases.map((p,i)=><div key={i} className="atem-readout p-2.5 text-xs space-y-2"><p className="font-sans">{p}</p><button className={BTN} onClick={()=>applyEditorial('banner',{phrase:p},'Frase')}>Enviar a gráfica Banner</button></div>)}</div></div>
          <div className={CARD}><h3 className="atem-label text-white mb-2.5">TEXTOS BÍBLICOS Y REFLEXIONES</h3><div className="space-y-2">{episode.scriptures.map((s,i)=><div key={i} className="atem-readout p-2.5 text-xs space-y-1.5"><strong className="text-sky-400">{s.reference}</strong><p className="font-sans">{s.text}</p>{s.reflection&&<p className="text-slate-400 font-sans">{s.reflection}</p>}<button className={BTN} onClick={()=>applyEditorial('scripture',{reference:s.reference,text:s.text},'Texto')}>Enviar a gráfica Versículo</button></div>)}</div></div>
          <div className={CARD}><h3 className="atem-label text-white mb-2.5">CITAS Y PENSAMIENTOS</h3><div className="space-y-2">{episode.quotes.map((q,i)=><div key={i} className="atem-readout p-2.5 text-xs space-y-1.5"><p className="font-sans">“{q.quote}”</p><strong className="text-slate-400 block">{q.author}</strong><button className={BTN} onClick={()=>applyEditorial('quote',{quote:q.quote,author:q.author,source:q.context||''},'Cita')}>Enviar a gráfica Cita</button></div>)}</div></div>
          <div className={`${CARD} md:col-span-2`}><h3 className="atem-label text-white mb-2.5">CINTA INFORMATIVA (TICKER)</h3><div className="space-y-1 atem-readout p-2.5">{episode.tickerNews.map((line,i)=><p key={i} className="text-xs text-slate-200 font-sans">• {line}</p>)}</div><button className={`${BTN} mt-2.5`} onClick={()=>applyEditorial('ticker',{items:episode.tickerNews},'Cinta')}>Enviar lista a gráfica Cinta</button></div>
        </div>
      </div>}
    </div>

    {editing&&<div role="dialog" aria-modal="true" aria-label="Editar bloque" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={saveBlock} className="atem-module border border-[#2e3646] w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-3.5 shadow-2xl"><div className="flex justify-between items-center border-b border-[#252b37] pb-2.5"><h3 className="text-sm font-black uppercase tracking-wider text-white">{episode.rundown.some(b=>b.id===editing.id)?'Editar segmento':'Añadir segmento'}</h3><button type="button" onClick={()=>setEditing(null)} aria-label="Cerrar" className="atem-btn p-1"><X className="w-4 h-4"/></button></div>
      <label className="block text-xs text-slate-300">Título<input className={`${FIELD} mt-1`} value={editing.title} maxLength={200} required onChange={e=>setEditing({...editing,title:e.target.value})}/></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-300">Conductor<input className={`${FIELD} mt-1`} value={editing.presenter} onChange={e=>setEditing({...editing,presenter:e.target.value})}/></label><label className="text-xs text-slate-300">Duración (segundos)<input className={`${FIELD} mt-1`} type="number" min={1} max={14400} required value={editing.durationSeconds} onChange={e=>setEditing({...editing,durationSeconds:Number(e.target.value)})}/></label></div>
      <label className="block text-xs text-slate-300">Escena en OBS{liveConnected?<select className={`${FIELD} mt-1`} value={editing.obsSceneTarget} onChange={e=>setEditing({...editing,obsSceneTarget:e.target.value})}><option value="">Selecciona escena</option>{!sceneNames.includes(editing.obsSceneTarget)&&editing.obsSceneTarget&&<option value={editing.obsSceneTarget}>{editing.obsSceneTarget} (no detectada)</option>}{sceneNames.map(name=><option key={name} value={name}>{name}</option>)}</select>:<input className={`${FIELD} mt-1`} placeholder="Nombre exacto de escena" value={editing.obsSceneTarget} onChange={e=>setEditing({...editing,obsSceneTarget:e.target.value})}/>}<span className="text-[10px] text-slate-500 mt-1 block">Con OBS conectado selecciona una escena real; desconectado puedes planificar su nombre.</span></label>
      <label className="block text-xs text-slate-300">Notas para realización<textarea rows={3} className={`${FIELD} mt-1`} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
      <label className="flex gap-2 items-center text-xs text-slate-300"><input type="checkbox" checked={!!editing.introVideoAttached} onChange={e=>setEditing({...editing,introVideoAttached:e.target.checked})}/>Este segmento requiere un video de intro (asignación de fuente en OBS por separado)</label>
      <div><div className="text-xs text-slate-400 mb-2">Gráficas previstas · no se activan automáticamente</div><div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">{TYPES.map(type=><label key={type} className="text-[11px] flex items-center gap-2 text-slate-300 rounded bg-[#07090c] border border-[#222834] px-2 py-1.5"><input type="checkbox" checked={(editing.graphicComponents||[]).includes(type)} onChange={e=>setEditing({...editing,graphicComponents:e.target.checked?[...(editing.graphicComponents||[]),type]:(editing.graphicComponents||[]).filter(t=>t!==type)})}/>{components[type]?.name||type}</label>)}</div>
      {!!Object.keys(customComponents).length && <div className="mt-3 space-y-1.5"><div className="text-xs text-sky-300">Gráficas independientes previstas</div>
      <div className="grid grid-cols-2 gap-1.5">{Object.values(customComponents).map(g=><label key={g.instanceId} className="text-[11px] flex items-center gap-2 text-slate-300 rounded bg-[#07090c] border border-[#222834] px-2 py-1.5">
        <input type="checkbox" checked={(editing.customGraphicIds||[]).includes(g.instanceId!)} onChange={e=>setEditing({...editing,customGraphicIds:e.target.checked?[...(editing.customGraphicIds||[]),g.instanceId!]:(editing.customGraphicIds||[]).filter(id=>id!==g.instanceId)})}/>{g.name}
      </label>)}</div></div>}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#252b37]"><button type="button" className={BTN} onClick={()=>setEditing(null)}>Cancelar</button><button type="submit" className={ORANGE}>Guardar bloque</button></div>
    </form></div>}

    {editEditorial&&<div role="dialog" aria-modal="true" aria-label="Editar guía editorial" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center"><div className="atem-module border border-[#2e3646] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl"><div className="flex justify-between items-center border-b border-[#252b37] pb-2.5"><div><h3 className="text-sm font-black uppercase tracking-wider text-white">Editar guía editorial</h3><p className="text-xs text-slate-400">Edita el episodio completo; las gráficas permanecen independientes hasta que decidas enviarlas.</p></div><button onClick={()=>setEditEditorial(false)} aria-label="Cerrar" className="atem-btn p-1"><X className="w-4 h-4"/></button></div>
      {([{key:'questions',title:'Preguntas al público'},{key:'phrases',title:'Frases'},{key:'tickerNews',title:'Cinta informativa'}] as {key:Section;title:string}[]).map(section=><div key={section.key} className="space-y-2"><div className="flex items-center justify-between"><h4 className="atem-label text-white">{section.title}</h4><button className={BTN} onClick={()=>editArray(section.key,'add')}><Plus className="w-3 h-3 inline"/> Añadir</button></div>{draft[section.key].map((v,i)=><div key={i} className="flex gap-2"><textarea rows={2} aria-label={`${section.title} ${i+1}`} className={FIELD} value={v} onChange={e=>updateSimple(section.key,i,e.target.value)}/><button className={BTN} title="Eliminar" onClick={()=>editArray(section.key,'remove',i)}><Trash2 className="w-4 h-4"/></button></div>)}</div>)}
      <div className="space-y-2"><div className="flex justify-between"><h4 className="atem-label text-white">Versículos</h4><button className={BTN} onClick={()=>setDraft(d=>({...d,scriptures:[...d.scriptures,{reference:'',text:'',reflection:''}]}))}>Añadir</button></div>{draft.scriptures.map((s,i)=><div key={i} className="p-3 rounded bg-[#07090c] border border-[#222834] space-y-2"><input aria-label={`Referencia ${i+1}`} className={FIELD} placeholder="Referencia" value={s.reference} onChange={e=>setDraft(d=>({...d,scriptures:d.scriptures.map((x,j)=>j===i?{...x,reference:e.target.value}:x)}))}/><textarea aria-label={`Texto ${i+1}`} className={FIELD} placeholder="Texto" rows={2} value={s.text} onChange={e=>setDraft(d=>({...d,scriptures:d.scriptures.map((x,j)=>j===i?{...x,text:e.target.value}:x)}))}/><textarea aria-label={`Reflexión ${i+1}`} className={FIELD} placeholder="Reflexión" rows={2} value={s.reflection||''} onChange={e=>setDraft(d=>({...d,scriptures:d.scriptures.map((x,j)=>j===i?{...x,reflection:e.target.value}:x)}))}/><button className={BTN} onClick={()=>setDraft(d=>({...d,scriptures:d.scriptures.filter((_,j)=>j!==i)}))}>Eliminar versículo</button></div>)}</div>
      <div className="space-y-2"><div className="flex justify-between"><h4 className="atem-label text-white">Citas</h4><button className={BTN} onClick={()=>setDraft(d=>({...d,quotes:[...d.quotes,{quote:'',author:'',context:''}]}))}>Añadir</button></div>{draft.quotes.map((q,i)=><div key={i} className="p-3 rounded bg-[#07090c] border border-[#222834] space-y-2"><textarea aria-label={`Cita ${i+1}`} className={FIELD} placeholder="Cita" rows={2} value={q.quote} onChange={e=>setDraft(d=>({...d,quotes:d.quotes.map((x,j)=>j===i?{...x,quote:e.target.value}:x)}))}/><input aria-label={`Autor ${i+1}`} className={FIELD} placeholder="Autor" value={q.author} onChange={e=>setDraft(d=>({...d,quotes:d.quotes.map((x,j)=>j===i?{...x,author:e.target.value}:x)}))}/><input aria-label={`Contexto ${i+1}`} className={FIELD} placeholder="Contexto" value={q.context||''} onChange={e=>setDraft(d=>({...d,quotes:d.quotes.map((x,j)=>j===i?{...x,context:e.target.value}:x)}))}/><button className={BTN} onClick={()=>setDraft(d=>({...d,quotes:d.quotes.filter((_,j)=>j!==i)}))}>Eliminar cita</button></div>)}</div>
      <div className="flex justify-end gap-2 sticky bottom-0 bg-[#11141a] border-t border-[#252b37] py-3"><button className={BTN} onClick={()=>setEditEditorial(false)}>Cancelar</button><button className={ORANGE} onClick={commitEditorial}><Save className="inline w-3.5 h-3.5 mr-1"/>Guardar guía</button></div>
    </div></div>}
  </div>;
};
