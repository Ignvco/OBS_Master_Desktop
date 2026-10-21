import type { ComponentType, EditorialComponentConfig, GraphicLayer, LayerOverride } from '../types';
import type { CSSProperties } from 'react';
import {templateCreativeStyle} from './creativeStyles.ts';

export interface TemplateLayer { id: string; label: string; contentKey?: string; }

// Existing template text remains intact. Each identifier is stable across editing and OBS rendering.
const defaults: Partial<Record<ComponentType, TemplateLayer[]>> = {
  'lower-third': [{id:'badge',label:'Distintivo',contentKey:'badge'},{id:'handle',label:'Usuario',contentKey:'handle'},{id:'headline',label:'Conductor',contentKey:'name'},{id:'subtitle',label:'Cargo',contentKey:'role'},{id:'accent',label:'Icono'}],
  banner: [{id:'accent',label:'Barra de color'},{id:'kicker',label:'Categoría',contentKey:'category'},{id:'headline',label:'Frase',contentKey:'phrase'},{id:'author',label:'Autor',contentKey:'author'}],
  chapter: [{id:'badge',label:'Etiqueta episodio',contentKey:'episodeBadge'},{id:'headline',label:'Título',contentKey:'title'},{id:'subtitle',label:'Subtítulo',contentKey:'subtitle'}],
  section: [{id:'badge',label:'Etiqueta',contentKey:'badge'},{id:'headline',label:'Título',contentKey:'title'},{id:'subtitle',label:'Detalle',contentKey:'detail'}],
  question: [{id:'kicker',label:'Etiqueta',contentKey:'tag'},{id:'headline',label:'Pregunta',contentKey:'question'},{id:'subtitle',label:'Indicaciones',contentKey:'instructions'},{id:'live-label',label:'Indicador en vivo',contentKey:'liveLabel'},{id:'status-dot',label:'Punto de estado'},{id:'question-icon',label:'Icono de pregunta'},{id:'heading-row',label:'Cabecera y separador'}],
  quote: [{id:'headline',label:'Cita',contentKey:'quote'},{id:'subtitle',label:'Autor',contentKey:'author'},{id:'kicker',label:'Origen',contentKey:'source'},{id:'quote-icon',label:'Símbolo de cita'},{id:'author-row',label:'Divisor y autor'}],
  scripture: [{id:'kicker',label:'Referencia',contentKey:'reference'},{id:'headline',label:'Versículo',contentKey:'text'},{id:'subtitle',label:'Versión',contentKey:'version'},{id:'heading',label:'Título de cabecera',contentKey:'heading'},{id:'heading-icon',label:'Icono de cabecera'},{id:'heading-row',label:'Cabecera y separador'}],
  social: [{id:'headline',label:'Título',contentKey:'title'},{id:'kicker',label:'Instagram',contentKey:'instagram'},{id:'subtitle',label:'YouTube',contentKey:'youtube'},{id:'spotify',label:'Spotify',contentKey:'spotify'},{id:'web',label:'Web',contentKey:'web'},{id:'instagram-icon',label:'Icono Instagram'},{id:'youtube-icon',label:'Icono YouTube'}],
  'social-pill': [{id:'icon',label:'Icono de la red'},{id:'headline',label:'Usuario de red'},{id:'badge',label:'Distintivo'}],
  'logo-bug': [{id:'headline',label:'Nombre programa',contentKey:'programTitle'},{id:'badge',label:'Indicador en vivo',contentKey:'liveText'},{id:'logo',label:'Imagen de marca'},{id:'accent',label:'Icono de la mosca'}],
  ticker: [{id:'badge',label:'Etiqueta',contentKey:'tag'},{id:'headline',label:'Cinta de noticias'},{id:'ticker-icon',label:'Icono etiqueta de cinta'}],
  editorial: [{id:'kicker',label:'Cabecera',contentKey:'kicker'},{id:'badge',label:'Fecha',contentKey:'date'},{id:'headline',label:'Titular',contentKey:'title'},{id:'subtitle',label:'Descripción',contentKey:'caption'},{id:'heading-row',label:'Cabecera y divisor'}],
  waiting: [{id:'accent',label:'Icono'},{id:'headline',label:'Título',contentKey:'title'},{id:'subtitle',label:'Subtítulo',contentKey:'subtitle'},{id:'badge',label:'Cuenta regresiva'},{id:'countdown-digits',label:'Números del contador'},{id:'message',label:'Mensaje de espera',contentKey:'message'}],
  break: [{id:'headline',label:'Título',contentKey:'title'},{id:'subtitle',label:'Subtítulo',contentKey:'subtitle'},{id:'message',label:'Mensaje de pausa',contentKey:'message'},{id:'badge',label:'Cuenta regresiva'},{id:'countdown-digits',label:'Números del contador'}],
  outro: [{id:'headline',label:'Título',contentKey:'title'},{id:'subtitle',label:'Subtítulo',contentKey:'subtitle'},{id:'kicker',label:'Redes',contentKey:'social'},{id:'credits',label:'Créditos',contentKey:'credits'}],
};
export const templateLayersFor = (type: ComponentType): TemplateLayer[] => defaults[type] ?? [];
export const editableTemplateLayersFor = (config: Pick<EditorialComponentConfig, 'type' | 'branding'>): TemplateLayer[] => {
  const result = templateLayersFor(config.type);
  if (config.type !== 'logo-bug' && config.branding?.visible && config.branding.assetUrl)
    return [...result, {id:'brand-logo',label:'Logo superpuesto'}];
  return result;
};
export const layerOverride = (config: Pick<EditorialComponentConfig, 'layerOverrides'> & Partial<Pick<EditorialComponentConfig,'layerOrder'>>, id: string): LayerOverride => config.layerOverrides?.[id] ?? {};

/** Non-destructive style overrides for fields in the original editorial HTML template. */
export function templateLayerProps(config: Pick<EditorialComponentConfig, 'layerOverrides'> & Partial<Pick<EditorialComponentConfig,'layerOrder'>>, id: string, selectedId?: string | null) {
  const p = layerOverride(config, id);
  const style: CSSProperties = {
    position: 'relative',
    translate: p.x || p.y ? `${p.x || 0}px ${p.y || 0}px` : undefined,
    rotate: p.rotation ? `${p.rotation}deg` : undefined,
    width: p.width && p.width > 0 ? p.width : undefined,
    height: p.height && p.height > 0 ? p.height : undefined,
    opacity: p.opacity,
    color: p.color,
    backgroundColor: p.backgroundColor,
    backgroundImage: p.backgroundColor ? 'none' : undefined,
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    fontFamily: p.fontFamily,
    letterSpacing: p.letterSpacing == null ? undefined : `${p.letterSpacing}px`,
    lineHeight: p.lineHeight,
    textAlign: p.textAlign,
    textTransform: p.textTransform,
    mixBlendMode: p.blendMode,
    borderRadius: p.borderRadius,
    zIndex: Array.isArray(config.layerOrder) ? 100 + (config.layerOrder.indexOf(id) >= 0 ? config.layerOrder.indexOf(id) : config.layerOrder.length) * 10 : p.zIndex,
    display: p.hidden ? 'none' : undefined,
    outline: selectedId === id ? '2px solid #FF6B00' : undefined,
    outlineOffset: selectedId === id ? 3 : undefined,
    ...templateCreativeStyle(p),
  };
  return { 'data-stdq-layer': id, style };
}

export function makeGraphicLayer(kind: GraphicLayer['kind'], count = 0): GraphicLayer {
  const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  return {
    id, kind, name: kind === 'text' ? 'Texto libre' : kind === 'image' ? 'Imagen' : 'Forma',
    x: 70 + (count % 5) * 18, y: 35 + (count % 5) * 18,
    width: kind === 'text' ? 360 : 150, height: kind === 'text' ? 70 : 120,
    rotation: 0, opacity: 1, zIndex: count + 10, hidden: false, locked: false,
    text: kind === 'text' ? 'Escribe aquí' : undefined,
    fontSize: 34, fontWeight: 700, color: '#FFFFFF',
    backgroundColor: kind === 'shape' ? '#FF6B00' : 'transparent',
    borderRadius: kind === 'shape' ? 24 : 0,
  };
}

export function moveGraphicLayer<T extends {x?:number;y?:number}>(layer: T, dx: number, dy: number): T {
  return {...layer, x: Math.round((layer.x ?? 0) + dx), y: Math.round((layer.y ?? 0) + dy)};
}
export function resizeGraphicLayer<T extends {width?:number;height?:number}>(layer: T, dw: number, dh: number): T {
  return {...layer, width: Math.max(16, Math.round((layer.width ?? 200) + dw)), height: Math.max(16, Math.round((layer.height ?? 80) + dh))};
}
