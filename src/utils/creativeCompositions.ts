import type {EditorialComponentConfig,GraphicLayer,LayerOverride} from '../types/index.ts';
import {editableTemplateLayersFor,makeGraphicLayer} from './graphicLayers.ts';

export type CreativeRecipe='cinema'|'impact'|'blank';
export const creativeRecipes:{id:CreativeRecipe;name:string;detail:string}[]=[
  {id:'cinema',name:'Cinemático',detail:'Tipografía editorial, acentos orgánicos y profundidad'},
  {id:'impact',name:'Impacto',detail:'Contraste fuerte, formas diagonales y letras grandes'},
  {id:'blank',name:'Lienzo libre',detail:'Oculta elementos de plantilla sin eliminarlos'},
];
const layer=(kind:GraphicLayer['kind'],index:number,name:string,style:Partial<GraphicLayer>):GraphicLayer=>({
  ...makeGraphicLayer(kind,index),name,...style,
});
export function creativeComposition(config:EditorialComponentConfig,recipe:CreativeRecipe):Partial<EditorialComponentConfig>{
  // Edits are reversible through the existing history. Original template layers are hidden, never deleted.
  const templateOverrides:Record<string,LayerOverride>={...config.layerOverrides};
  for(const built of editableTemplateLayersFor(config)){
    const preserveTimer=(config.type==='waiting'||config.type==='break') && built.id==='badge' && recipe!=='blank';
    templateOverrides[built.id]={...templateOverrides[built.id],hidden:!preserveTimer,
      ...(preserveTimer?{x:0,y:260}:{}),
    };
  }
  if(recipe==='blank')return {layerOverrides:templateOverrides,geometry:{...config.geometry,backgroundColor:'transparent',backgroundGradient:{...config.geometry.backgroundGradient,enabled:false,type:'linear',angle:135,from:'#101116',to:'#101116'}}};
  const full=['waiting','break','outro','editorial','quote','question','scripture','chapter'].includes(config.type);
  const width=full?1920:config.geometry.width;
  const height=full?1080:config.geometry.height;
  const impact=recipe==='impact';
  const background=impact?'#0B0B11':'#090B11';
  const orange=impact?'#FF6B00':'#FF8C39';
  const title=String(config.content.title||config.content.phrase||config.content.question||config.content.quote||config.content.name||config.name).replace(/\s+/g,' ').slice(0,140);
  const headline=title.length>72?title.slice(0,69)+'…':title;
  const scale=width/1920;
  const size=(v:number)=>Math.round(v*scale);
  const rows:GraphicLayer[]=[];
  const add=(kind:GraphicLayer['kind'],name:string,props:Partial<GraphicLayer>)=>{rows.push(layer(kind,(config.layers??[]).length+rows.length,name,props));};
  if(full){
    add('shape','Acento editorial', {x:impact?1370:1430,y:impact?140:95,width:impact?510:400,height:impact?770:680,
      shapePreset:impact?'slant':'blob',rotation:impact?-10:12,backgroundColor:orange,
      gradientMode:'linear',gradientFrom:orange,gradientTo:impact?'#D72A2A':'#FFB35B',gradientAngle:125,opacity:impact?.96:.84});
    add('shape','Círculo de profundidad',{x:impact?1440:1570,y:impact?650:730,width:impact?360:240,height:impact?360:240,
      shapePreset:'circle',backgroundColor:'#651F25',gradientMode:'radial',gradientFrom:'#DB4E26',gradientTo:'#41152C',opacity:.8});
    add('text','Identidad del programa',{x:118,y:104,width:890,height:70,fontSize:31,fontWeight:800,letterSpacing:5,
      text:'SI TE DIJERA QUE?',fontFamily:'Barlow Condensed',color:orange,textTransform:'uppercase'});
    add('shape','Línea divisora',{x:120,y:208,width:impact?1030:765,height:7,backgroundColor:orange,shapePreset:'pill'});
    add('text','Título protagonista',{x:118,y:impact?300:320,width:impact?1450:1200,height:impact?215:195,
      fontSize:impact?110:94,fontWeight:800,lineHeight:1.03,letterSpacing:-3,text:headline.toUpperCase(),
      fontFamily:impact?'Barlow Condensed':'Plus Jakarta Sans',color:'#FFFFFF',textTransform:'uppercase'});
    add('text','Mensaje secundario',{x:124,y:910,width:1120,height:90,fontSize:35,fontWeight:500,
      text:String(config.content.subtitle||'UNA EXPERIENCIA QUE VA MÁS ALLÁ DE LA PANTALLA').slice(0,125),color:'#DFDEE9'});
  } else {
    add('shape','Cinta de acento',{x:0,y:0,width:Math.max(16,size(20)),height:height,
      shapePreset:impact?'slant':'rectangle',backgroundColor:orange});
    add('shape','Placa editorial',{x:Math.max(20,size(44)),y:height*.12,width:Math.round(width*.9),height:Math.round(height*.76),
      shapePreset:impact?'ticket':'pill',backgroundColor:impact?'#23212A':'#1C202B',gradientMode:'linear',gradientFrom:impact?'#35212B':'#1E232C',gradientTo:'#08090D',gradientAngle:135});
    add('text','Título editorial',{x:Math.max(40,size(90)),y:height*.30,width:Math.round(width*.78),height:Math.round(height*.5),
      text:headline,fontSize:Math.min(54,Math.max(24,Math.round(height*.26))),fontWeight:800,color:'#FFFFFF',letterSpacing:-.8});
  }
  const newGeometry={...config.geometry,backgroundColor:background,backgroundGradient:{enabled:true,type:'linear' as const,from:background,to:impact?'#2B1021':'#121423',angle:impact?35:145},
    ...(full?{width:1920,height:1080,x:0,y:0,scale:1,rotation:0,borderRadius:0,padding:0}:{}),
  };
  return {geometry:newGeometry,layerOverrides:templateOverrides,layers:[...(config.layers??[]),...rows]};
}
