import type {CSSProperties} from 'react';
import type {GraphicLayer, LayerOverride} from '../types';

export type ShapePreset = 'rectangle'|'pill'|'circle'|'diamond'|'hexagon'|'chevron'|'slant'|'ticket'|'blob';
export type GradientMode = 'none'|'linear'|'radial';
export type ShadowPreset = 'none'|'soft'|'lifted'|'glow'|'deep';
export const shapePresets: {value:ShapePreset;label:string}[] = [
  {value:'rectangle',label:'Rectángulo'}, {value:'pill',label:'Píldora'},
  {value:'circle',label:'Círculo / óvalo'}, {value:'diamond',label:'Diamante'},
  {value:'hexagon',label:'Hexágono'}, {value:'chevron',label:'Chevron'},
  {value:'slant',label:'Diagonal'}, {value:'ticket',label:'Ticket'}, {value:'blob',label:'Orgánica'},
];
export type StyledLayer = Partial<Pick<GraphicLayer,
  'shapePreset'|'gradientMode'|'gradientFrom'|'gradientTo'|'gradientAngle'|'borderWidth'|'borderColor'|'shadowPreset'|
  'fontFamily'|'textAlign'|'lineHeight'|'letterSpacing'|'textTransform'|'imageFit'|'imagePosition'|'blendMode'>>;
const clips:Partial<Record<ShapePreset,string>> = {
  diamond:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
  hexagon:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
  chevron:'polygon(0 0,75% 0,100% 50%,75% 100%,0 100%,25% 50%)',
  slant:'polygon(12% 0,100% 0,88% 100%,0 100%)',
  ticket:'polygon(0 0,100% 0,100% 40%,95% 50%,100% 60%,100% 100%,0 100%,0 60%,5% 50%,0 40%)',
  blob:'polygon(7% 12%,24% 3%,60% 7%,88% 0%,100% 26%,92% 62%,100% 84%,74% 100%,39% 89%,13% 100%,0% 70%,5% 42%)',
};
export function safeShapeStyle(data:StyledLayer):CSSProperties {
  const radius=data.shapePreset==='pill'?9999:data.shapePreset==='circle'?'50%':undefined;
  const shadow:Record<ShadowPreset,string>={
    none:'none', soft:'0 8px 26px rgba(0,0,0,.24)', lifted:'0 18px 46px rgba(0,0,0,.50)',
    glow:'0 0 35px rgba(255,107,0,.50)', deep:'0 28px 75px rgba(0,0,0,.72)',
  };
  // Colors are authored by a native picker or a validated HEX field, never arbitrary CSS.
  const gradient = data.gradientMode === 'radial'
    ? `radial-gradient(circle at center, ${data.gradientFrom??'#FF6B00'}, ${data.gradientTo??'#241027'})`
    : data.gradientMode === 'linear'
      ? `linear-gradient(${Number.isFinite(data.gradientAngle)?data.gradientAngle:135}deg, ${data.gradientFrom??'#FF6B00'}, ${data.gradientTo??'#241027'})`
      : undefined;
  return {
    ...(gradient?{backgroundImage:gradient}:data.gradientMode === 'none'?{backgroundImage:'none'}:{}),
    ...(radius!==undefined?{borderRadius:radius}:{}),
    ...(data.shapePreset&&clips[data.shapePreset]?{clipPath:clips[data.shapePreset]}:{}),
    ...(data.borderWidth === 0 ? {borderStyle:'none' as const,borderWidth:0}:
       typeof data.borderWidth === 'number' && data.borderWidth>0 ? {borderStyle:'solid' as const,borderWidth:data.borderWidth,borderColor:data.borderColor}:{}),
    ...(data.shadowPreset?{boxShadow:shadow[data.shadowPreset],textShadow:data.shadowPreset==='none'?'none':undefined}:{}),
  };
}
export function customTypographyStyle(layer:GraphicLayer):CSSProperties {
  return {
    fontFamily:layer.fontFamily||undefined,
    textAlign:layer.textAlign,
    lineHeight:layer.lineHeight,
    letterSpacing:layer.letterSpacing == null ? undefined : `${layer.letterSpacing}px`,
    textTransform:layer.textTransform,
    justifyContent:layer.textAlign==='center'?'center':layer.textAlign==='right'?'flex-end':undefined,
  };
}
export function isHexColor(value:string):boolean {return /^#[0-9a-fA-F]{6}$/.test(value.trim());}
export function clampDesignNumber(value:number,min:number,max:number):number {
  return Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;
}
// Kept here for explicit type compatibility with builtin template overrides.
export function templateCreativeStyle(data:LayerOverride):CSSProperties {return safeShapeStyle(data);}
