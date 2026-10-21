import React from 'react';
import { EditorialComponentConfig, CountdownState } from '../../types';
import { formatTime } from '../../utils/animationEngine';
import { templateLayerProps } from '../../utils/graphicLayers';
import {layerStackZ} from '../../utils/layerStack';
import {BrandLogoLayer} from './BrandLogoLayer';
import { Quote as QuoteIcon } from 'lucide-react';
import { ComponentGlyph } from './ComponentGlyph';
import { TickerMarquee } from './TickerMarquee';
import {safeShapeStyle,customTypographyStyle} from '../../utils/creativeStyles';
import {socialPillNetworkAt} from '../../utils/socialPill';
import {Facebook, Globe2, AtSign, Twitch, Music2, Podcast, Instagram, Youtube} from 'lucide-react';

interface GraphicRendererProps {
  config: EditorialComponentConfig;
  countdown?: CountdownState;
  isCanvasPreview?: boolean;
  selectedLayerId?: string | null;
}

export const GraphicComponentRenderer: React.FC<GraphicRendererProps> = ({ config, countdown, isCanvasPreview = false, selectedLayerId }) => {
  const { type, content, font, geometry } = config;
  const [socialNow, setSocialNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (type !== 'social-pill' || !(content.rotationMode === 'rotate' || (!content.rotationMode && Number(content.rotationIntervalSeconds) > 0))) return;
    const timer = window.setInterval(() => setSocialNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [type, content.rotationMode, content.rotationIntervalSeconds]);
  const currentSocial = type === 'social-pill' ? socialPillNetworkAt(content, socialNow) : null;
  const socialIcon = currentSocial?.platform === 'youtube' ? Youtube :
    currentSocial?.platform === 'spotify' ? Podcast :
    currentSocial?.platform === 'facebook' ? Facebook :
    currentSocial?.platform === 'tiktok' ? Music2 :
    currentSocial?.platform === 'twitch' ? Twitch :
    currentSocial?.platform === 'web' ? Globe2 :
    currentSocial?.platform === 'x' ? AtSign : Instagram;
  const SocialIcon = socialIcon;

  const layer = (id: string, base?: React.CSSProperties) => {
    const props = templateLayerProps(config, id, isCanvasPreview ? selectedLayerId : null);
    return { ...props, style: { ...base, ...props.style } };
  };

  // Custom typography style
  const textStyle: React.CSSProperties = {
    fontFamily: font.family === 'Plus Jakarta Sans' ? 'var(--font-sans)' : 
                font.family === 'Playfair Display' ? 'var(--font-editorial)' :
                font.family === 'Barlow Condensed' ? 'var(--font-condensed)' :
                font.family === 'JetBrains Mono' ? 'var(--font-mono)' :
                font.family === 'Space Grotesk' ? "'Space Grotesk', sans-serif" : 'sans-serif',
    fontSize: `${font.size}px`,
    fontWeight: font.weight,
    lineHeight: font.lineHeight,
    letterSpacing: `${font.letterSpacing}px`,
    color: font.color,
    textTransform: font.textTransform,
    textAlign: font.align,
    textShadow: !geometry.flatMode && font.shadowBlur ? `0 2px ${font.shadowBlur}px ${font.shadowColor ?? 'rgba(0,0,0,0.6)'}` : undefined,
  };

  // Base container geometry
  const containerStyle: React.CSSProperties = {
    width: `${geometry.width}px`,
    height: `${geometry.height}px`,
    borderRadius: `${geometry.borderRadius}px`,
    borderWidth: `${geometry.borderWidth}px`,
    borderColor: geometry.borderColor,
    borderStyle: geometry.borderWidth > 0 ? 'solid' : 'none',
    backgroundColor: geometry.backgroundGradient?.enabled
      ? undefined
      : geometry.backgroundColor,
    backgroundImage: geometry.backgroundGradient?.enabled
      ? geometry.backgroundGradient.type==='radial'
        ? `radial-gradient(circle at center, ${geometry.backgroundGradient.from}, ${geometry.backgroundGradient.to})`
        : `linear-gradient(${geometry.backgroundGradient.angle}deg, ${geometry.backgroundGradient.from}, ${geometry.backgroundGradient.to})`
      : undefined,
    boxShadow: geometry.flatMode ? 'none' : geometry.boxShadow,
    opacity: type === 'logo-bug' && typeof content.opacity === 'number' ? geometry.opacity * Math.max(0,Math.min(1,content.opacity/100)) : geometry.opacity,
    padding: `${geometry.padding}px`,
    overflow: 'hidden',
    position: 'relative',
  };

  const renderTemplate = () => {
  switch (type) {
    case 'lower-third':
      return (
        <div style={containerStyle} className="flex items-center gap-4 select-none">
          {/* Spotlight Icon Badge */}
          {config.glyph?.mode !== 'none' && <div {...layer('accent')} style={{...layer('accent').style, width:Math.max(64,Math.min(220,(config.glyph?.size ?? 32)+22)),height:Math.max(64,Math.min(220,(config.glyph?.size ?? 32)+22))}} className="rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#E85D04] flex items-center justify-center shrink-0 shadow-lg shadow-[#FF6B00]/30 border border-white/20">
            <ComponentGlyph config={config} kind="microphone" />
          </div>}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span {...layer('badge')} className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#FF6B00] text-black tracking-wider">
                {content.badge ?? 'EN VIVO'}
              </span>
              {content.handle && (
                <span {...layer('handle')} className="text-xs font-mono text-slate-400 font-semibold">
                  {content.handle}
                </span>
              )}
            </div>
            <div {...layer('headline', textStyle)} className="mt-1 font-bold truncate">
              {content.name ?? 'Nombre del Conductor'}
            </div>
            <div {...layer('subtitle')} className="text-xs text-slate-300 font-medium truncate mt-0.5">
              {content.role ?? 'Rol / Especialidad'}
            </div>
          </div>
        </div>
      );

    case 'banner':
      return (
        <div style={containerStyle} className="flex items-center gap-5 select-none">
          <div {...layer('accent')} className="w-2.5 h-16 rounded-full bg-[#FF6B00] shrink-0 shadow-lg shadow-[#FF6B00]/40" />
          <div className="flex-1 min-w-0">
            {content.category && (
              <span {...layer('kicker')} className="text-xs font-extrabold text-[#FF6B00] tracking-wider uppercase block mb-1">
                {content.category}
              </span>
            )}
            <div {...layer('headline', textStyle)} className="truncate">
              {content.phrase ?? 'Frase destacada del programa...'}
            </div>
            {content.author && <div {...layer('author')} className="text-xs text-slate-300 mt-1">{content.author}</div>}
          </div>
        </div>
      );

    case 'chapter':
      return (
        <div style={containerStyle} className="flex flex-col items-center justify-center text-center select-none space-y-3">
          {content.episodeBadge && (
            <span {...layer('badge')} className="text-xs font-extrabold tracking-widest text-[#FF6B00] px-3 py-1 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/30 uppercase">
              {content.episodeBadge}
            </span>
          )}
          <div {...layer('headline', textStyle)} className="max-w-4xl">
            {content.title ?? 'Título del Episodio'}
          </div>
          {content.subtitle && (
            <p {...layer('subtitle')} className="text-sm md:text-base text-slate-300 font-normal max-w-2xl leading-relaxed">
              {content.subtitle}
            </p>
          )}
        </div>
      );

    case 'section':
      return (
        <div style={containerStyle} className="flex flex-col justify-center select-none space-y-1">
          {content.badge && (
            <span {...layer('badge')} className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF6B00]">
              {content.badge}
            </span>
          )}
          <div {...layer('headline', textStyle)} className="truncate">
            {content.title ?? 'Sección del Programa'}
          </div>
          {content.detail && (
            <div {...layer('subtitle')} className="text-xs text-slate-400 truncate">
              {content.detail}
            </div>
          )}
        </div>
      );

    case 'question':
      return (
        <div style={containerStyle} className="flex flex-col justify-between select-none">
          <div {...layer('heading-row')} className="flex items-center justify-between border-b border-white/10 pb-2">
            <span {...layer('kicker')} className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider flex items-center gap-1.5">
              <span {...layer('question-icon')} className="inline-flex shrink-0"><ComponentGlyph config={config} kind="question" size={18} /></span>
              <span>{content.tag ?? 'TU TURNO · PARTICIPA'}</span>
            </span>
            {content.showLiveLabel !== false && <span {...layer('live-label')} className="text-[11px] text-slate-400 font-mono">{content.liveLabel ?? 'EN VIVO'}</span>}
          </div>
          <div {...layer('headline', textStyle)} className="py-2">
            {content.question ?? '¿Cuál es tu opinión sobre este tema?'}
          </div>
          {content.instructions && (
            <div {...layer('subtitle')} className="text-xs text-slate-400 pt-1 border-t border-white/5 flex items-center gap-2">
              {content.showStatusDot !== false && <span {...layer('status-dot')} className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
              <span>{content.instructions}</span>
            </div>
          )}
        </div>
      );

    case 'quote':
      return (
        <div style={containerStyle} className="flex flex-col justify-between select-none relative">
          {content.showQuoteIcon !== false && <span {...layer('quote-icon')} style={{...layer('quote-icon').style,position:'absolute',right:24,top:24}} className="inline-flex text-[#FF6B00]/20 pointer-events-none"><QuoteIcon className="w-12 h-12" /></span>}
          <div {...layer('headline', textStyle)} className="italic relative z-10">
            {content.showQuotationMarks === false ? (content.quote ?? 'Cita de autor o pensador...') : `“${content.quote ?? 'Cita de autor o pensador...'}”` }
          </div>
          <div {...layer('author-row')} className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span {...layer('subtitle')} className="font-bold text-white text-sm">
              — {content.author ?? 'Autor'}
            </span>
            {content.source && (
              <span {...layer('kicker')} className="text-slate-400 italic">
                {content.source}
              </span>
            )}
          </div>
        </div>
      );

    case 'scripture':
      return (
        <div style={containerStyle} className="flex flex-col justify-between select-none">
          <div {...layer('heading-row')} className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-extrabold text-[#FF6B00] tracking-wider flex items-center gap-1.5 uppercase">
              {content.showHeadingIcon !== false && <span {...layer('heading-icon')} className="inline-flex shrink-0"><ComponentGlyph config={config} kind="scripture" size={18} /></span>}
              <span {...layer('heading')}>{content.heading ?? 'PALABRA & REFLEXIÓN'}</span>
            </span>
            <span {...layer('kicker')} className="text-sm font-bold text-white font-mono">
              {content.reference ?? '2 Corintios 4:18'}
            </span>
          </div>
          <div {...layer('headline', textStyle)} className="italic py-2">
            {content.showQuotationMarks === false ? (content.text ?? 'Texto bíblico o reflexión trascendente...') : `“${content.text ?? 'Texto bíblico o reflexión trascendente...'}”`}
          </div>
          {content.version && (
            <div {...layer('subtitle')} className="text-[11px] text-slate-400 pt-1 text-right border-t border-white/5">
              {content.version}
            </div>
          )}
        </div>
      );

    case 'social':
      return (
        <div style={containerStyle} className="flex flex-col justify-between select-none">
          <div {...layer('headline')} className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider">
            {content.title ?? 'CONÉCTATE CON NOSOTROS'}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-white">
              <span {...layer('instagram-icon')} className="inline-flex"><ComponentGlyph config={config} kind="instagram" size={20} className="text-pink-400" /></span>
              <span {...layer('kicker')} className="font-semibold">{content.instagram ?? '@sitedijeraqueoficial'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white">
              <span {...layer('youtube-icon')} className="inline-flex"><ComponentGlyph config={config} kind="youtube" size={20} className="text-red-500" /></span>
              <span {...layer('subtitle')} className="font-semibold">{content.youtube ?? 'Si Te Dijera Que'}</span>
            </div>
            {(content.spotify || content.web) && <div className="flex gap-3 text-[11px] pt-1 flex-wrap text-slate-300">
              {content.spotify && <span {...layer('spotify')}>{content.spotify}</span>}
              {content.web && <span {...layer('web')}>{content.web}</span>}
            </div>}
          </div>
        </div>
      );

    case 'social-pill':
      return (
        <div style={containerStyle} className="flex items-center justify-between px-4 select-none gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span {...layer('icon')} className="inline-flex items-center justify-center shrink-0">
              {currentSocial?.iconAssetUrl ?
                <img src={currentSocial.iconAssetUrl} alt="" className="w-6 h-6 object-contain" draggable={false}/> :
                <SocialIcon size={20} className="text-[#FF6B00]" aria-hidden="true"/>}
            </span>
            <span {...layer('headline', textStyle)} className="font-bold truncate">
              {currentSocial?.handle ?? ''}
            </span>
          </div>
          {content.showBadge !== false && <span {...layer('badge')} className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#FF6B00] text-black shrink-0">
            {content.badgeText ?? 'FOLLOW'}
          </span>}
        </div>
      );

    case 'logo-bug': {
      const hasLogo = !!(config.branding?.assetUrl && config.branding.visible);
      return (
        <div style={{...containerStyle, position:'relative'}} className="select-none">
          {hasLogo && <img data-stdq-layer="logo" src={config.branding!.assetUrl} alt="Logo del programa" draggable={false}
            style={{
              ...layer('logo').style,
              position:'absolute', left:config.branding!.x, top:config.branding!.y,
              width:layer('logo').style.width ?? config.branding!.width, maxWidth:'none',height:'auto',
              objectFit:'contain',opacity:layer('logo').style.opacity ?? config.branding!.opacity,
              transform:`rotate(${config.branding!.rotation}deg)`,
            }}/>
          }
          {(content.showIcon ?? !hasLogo) && <div {...layer('accent')}
            className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF6B00] to-[#E85D04] flex items-center justify-center shadow-md">
            <ComponentGlyph config={config} kind="microphone" size={20}/>
          </div>}
          {(content.showProgramTitle ?? !hasLogo) && <span {...layer('headline',textStyle)}
            className="absolute bottom-2 left-10 right-2 font-extrabold leading-tight text-white">
            {content.programTitle ?? 'SI TE DIJERA QUE?'}
          </span>}
          {content.showLiveBadge !== false && <span {...layer('badge')}
            className="absolute bottom-1 right-2 text-[9px] text-[#FF6B00] font-bold tracking-widest rounded bg-black/60 px-1.5 py-0.5">
            {content.liveText ?? 'EN VIVO'}
          </span>}
        </div>
      );
    }

    case 'ticker':
      return (
        <div style={containerStyle} className="flex items-center gap-4 select-none">
          <div {...layer('badge')} className="px-3 py-1 rounded bg-[#FF6B00] text-black font-extrabold text-xs tracking-wider shrink-0 uppercase inline-flex items-center gap-2">
            <span {...layer('ticker-icon')} className="inline-flex"><ComponentGlyph config={config} kind="live" size={18}/></span>
            {content.tag ?? 'EN VIVO'}
          </div>
          <div {...layer('headline')} className="flex-1 min-w-0 whitespace-nowrap overflow-hidden">
            <TickerMarquee className="w-full whitespace-nowrap" style={textStyle}
              items={content.items} speedSeconds={content.speedSeconds}
              direction={content.tickerDirection} paused={content.tickerPaused}/>
          </div>

        </div>
      );

    case 'editorial':
      return (
        <div style={containerStyle} className="flex flex-col justify-between select-none">
          <div {...layer('heading-row')} className="flex items-center justify-between border-b border-white/10 pb-4">
            <span {...layer('kicker')} className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-widest">
              {content.kicker ?? 'EDICIÓN ESPECIAL'}
            </span>
            <span {...layer('badge')} className="text-xs text-slate-400 font-mono">{content.date ?? 'OCTUBRE 2026'}</span>
          </div>

          <div {...layer('headline', textStyle)} className="max-w-5xl py-6 font-serif">
            {content.title ?? 'Aquello que permanece oculto sostiene los cimientos de la verdad.'}
          </div>

          <div {...layer('subtitle')} className="text-base text-slate-300 font-sans border-t border-white/10 pt-4 max-w-3xl leading-relaxed">
            {content.caption ?? 'Una conversación sin prisas entre la fe, la psicología y la experiencia humana.'}
          </div>
        </div>
      );

    case 'waiting':
      return (
        <div style={containerStyle} className="flex flex-col items-center justify-center text-center select-none space-y-6">
          {config.glyph?.mode !== 'none' && <div {...layer('accent')} style={{...layer('accent').style,width:Math.max(96,Math.min(240,(config.glyph?.size ?? 56)+40)),height:Math.max(96,Math.min(240,(config.glyph?.size ?? 56)+40))}} className="rounded-3xl bg-gradient-to-br from-[#FF6B00] to-[#E85D04] flex items-center justify-center shadow-2xl shadow-[#FF6B00]/40 border border-white/20">
            <ComponentGlyph config={config} kind="microphone" size={56} />
          </div>}

          <div {...layer('headline', textStyle)} className="max-w-4xl">
            {content.title ?? 'COMENZAMOS EN BREVE'}
          </div>

          <div {...layer('subtitle')} className="text-lg text-slate-300 font-medium">
            {content.subtitle ?? 'Si Te Dijera Que? · Transmisión Oficial'}
          </div>

          {content.showCountdown && (
            <div {...layer('badge')} className="p-6 rounded-3xl bg-black/50 border border-white/10 backdrop-blur-md">
              <div {...layer('countdown-digits')} className="text-6xl md:text-7xl font-mono font-extrabold text-white tracking-tight tabular-nums">
                {formatTime(countdown?.remainingSeconds ?? 300)}
              </div>
            </div>
          )}
          {content.message !== '' && <div {...layer('message')} className="text-xs text-[#FF6B00] font-bold tracking-widest uppercase text-center">
            {content.message ?? countdown?.message ?? 'Ajusta tu audio y prepárate'}
          </div>}

        </div>
      );

    case 'break':
      return (
        <div style={containerStyle} className="flex flex-col items-center justify-center text-center select-none space-y-6">
          <div {...layer('headline', textStyle)} className="max-w-4xl">
            {content.title ?? 'YA VOLVEMOS'}
          </div>
          <div {...layer('subtitle')} className="text-lg text-slate-300 font-medium">
            {content.subtitle ?? 'Pausa breve en la conversación'}
          </div>
          {content.message && <div {...layer('message')} className="text-sm text-slate-300 text-center">{content.message}</div>}
          {content.showCountdown && (
            <div {...layer('badge')} className="p-5 rounded-2xl bg-black/50 border border-white/10 text-4xl font-mono font-bold text-white tabular-nums">
              <span {...layer('countdown-digits')}>{formatTime(countdown?.remainingSeconds ?? 120)}</span>
            </div>
          )}
        </div>
      );

    case 'outro':
      return (
        <div style={containerStyle} className="flex flex-col items-center justify-center text-center select-none space-y-6">
          <div {...layer('headline', textStyle)} className="max-w-4xl">
            {content.title ?? 'GRACIAS POR ACOMPAÑARNOS'}
          </div>
          <div {...layer('subtitle')} className="text-lg text-slate-300 font-medium">
            {content.subtitle ?? 'Hasta nuestro próximo encuentro semanal'}
          </div>
          <div {...layer('kicker')} className="text-sm text-[#FF6B00] font-bold tracking-wider">
            {content.social ?? '@sitedijeraqueoficial'}
          </div>
          {content.credits && <div {...layer('credits')} className="text-xs text-slate-300 text-center">{content.credits}</div>}
        </div>
      );

    default:
      return (
        <div style={containerStyle} className="flex items-center justify-center text-white">
          {config.name}
        </div>
      );
  }
  };
  const renderAddedLayers = () => <React.Fragment>
    {(config.layers ?? []).filter(item => !item.hidden).map(item => (
      <div key={item.id} data-stdq-layer={item.id} className="absolute select-none"
        style={{left:item.x, top:item.y, width:item.width, height:item.height,
          rotate:`${item.rotation}deg`, opacity:item.opacity, zIndex:layerStackZ(config,item.id) ?? item.zIndex,
          backgroundColor:item.kind === 'shape' ? item.backgroundColor : 'transparent',
          borderRadius:item.borderRadius ?? 0,
          ...safeShapeStyle(item),
          ...(item.kind==='text'?customTypographyStyle(item):{}),
          mixBlendMode:item.blendMode||'normal',
          outline: isCanvasPreview && selectedLayerId === item.id ? '2px solid #FF6B00' : undefined,
          outlineOffset:isCanvasPreview && selectedLayerId===item.id?2:undefined,
          overflow:'hidden', whiteSpace:item.kind === 'text' ? 'pre-wrap' : undefined,
          overflowWrap:'anywhere', color:item.color,
          fontSize:item.fontSize, fontWeight:item.fontWeight,
          display:'flex', alignItems:'center',
        }}>
        {item.kind === 'text' && (item.text ?? (isCanvasPreview ? 'Texto' : ''))}
        {item.kind === 'image' && item.assetUrl && <img draggable={false} src={item.assetUrl} alt=""
          className="w-full h-full pointer-events-none" style={{objectFit:item.imageFit||'contain',objectPosition:item.imagePosition||'center'}} />}
        {item.kind === 'image' && !item.assetUrl && isCanvasPreview &&
          <span className="w-full h-full border border-dashed border-[#FF6B00]/60 flex items-center justify-center text-xs text-slate-300 bg-black/30 text-center p-2">Sube una imagen desde Capas</span>}
      </div>
    ))}
  </React.Fragment>;
  // Legacy documents retain their former DOM hierarchy and appearance. For
  // explicitly reordered documents all elements share the template's paint
  // context: authored and added elements can cross one another in z-order.
  const template = renderTemplate() as React.ReactElement<{children?:React.ReactNode}>;
  const useUniversalStack = Array.isArray(config.layerOrder);
  return <div data-stdq-stacking={useUniversalStack ? 'unified' : 'legacy'}
    className={`${geometry.flatMode ? 'stdq-flat' : ''} ${geometry.hideBorders ? 'stdq-no-borders' : ''}`}
    style={{position:'relative',width:geometry.width,height:geometry.height}}>
    {useUniversalStack
      ? React.cloneElement(template, undefined, <>{template.props.children}{renderAddedLayers()}<BrandLogoLayer config={config}/></>)
      : <>{template}{renderAddedLayers()}</>}
  </div>;
};
