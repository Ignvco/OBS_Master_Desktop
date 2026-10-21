import React, { useEffect, useState } from 'react';
import { BookOpen, CircleHelp, Instagram, MessageCircle, Mic2, Radio, Sparkles, Youtube } from 'lucide-react';
import type { ComponentGlyphSettings, EditorialComponentConfig } from '../../types';

export const DEFAULT_COMPONENT_GLYPH: ComponentGlyphSettings = {
  mode: 'default', size: 32, opacity: 1, radius: 4,
};
export type GlyphKind = 'microphone' | 'question' | 'scripture' | 'instagram' | 'youtube' | 'live' | 'sparkles';
const ICONS: Record<GlyphKind, React.ComponentType<{size?:number;strokeWidth?:number}>> = {
  microphone: Mic2, question: CircleHelp, scripture: BookOpen,
  instagram: Instagram, youtube: Youtube, live: Radio, sparkles: Sparkles,
};
/** An uploaded brand logo is used only when explicitly chosen as glyph, leaving the
 * separately positioned BrandLogoLayer untouched. Backward compatible with old presets. */
export const ComponentGlyph: React.FC<{config: EditorialComponentConfig; kind: GlyphKind; size?: number; className?: string}> = ({config,kind,size,className}) => {
  const options={...DEFAULT_COMPONENT_GLYPH,...config.glyph};
  const chosenSize=Math.max(12,Math.min(220,Number(config.glyph?.size ?? size ?? DEFAULT_COMPONENT_GLYPH.size) || 32));
  const url=options.mode==='logo' ? config.branding?.assetUrl : options.mode==='image' ? options.assetUrl : undefined;
  const [brokenUrl,setBrokenUrl] = useState<string|null>(null);
  useEffect(()=>setBrokenUrl(null),[url]);
  if (options.mode === 'none') return null;
  const style={width:chosenSize,height:chosenSize,opacity:options.opacity,borderRadius:Math.max(0,options.radius)};
  if(options.mode!=='default' && url && brokenUrl!==url)
    return <img className={'shrink-0 object-contain '+(className||'')} draggable={false} src={url} alt="" onError={()=>setBrokenUrl(url)} style={style}/>;
  const Icon=ICONS[kind] ?? MessageCircle;
  return <span className={'inline-flex items-center justify-center shrink-0 '+(className||'')} style={style} aria-hidden="true"><Icon size={chosenSize} strokeWidth={1.8}/></span>;
};
