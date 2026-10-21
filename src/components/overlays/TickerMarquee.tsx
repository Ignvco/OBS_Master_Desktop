import React, { useEffect, useRef, useState } from 'react';
import { sanitizeTickerItems, tickerDirection, tickerSeconds, tickerLoopWidth } from '../../utils/tickerMotion';

interface Props {
  items: unknown;
  speedSeconds?: number;
  direction?: string;
  paused?: boolean;
  style?: React.CSSProperties;
  className?: string;
}
/** A seamlessly repeating, GPU-transformed news crawl. The first group is repeated
 * exactly once, so the half-cycle transform has no seam or text jump. */
export const TickerMarquee: React.FC<Props> = ({ items, speedSeconds, direction, paused, style, className }) => {
  const values = sanitizeTickerItems(items);
  const firstGroup = useRef<HTMLDivElement>(null);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const node = firstGroup.current;
    if (!node) return;
    let frame = 0;
    let alive = true;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (alive) setCycle(tickerLoopWidth(node.getBoundingClientRect().width)); });
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(node);
    document.fonts?.ready.then(update).catch(() => {});
    return () => { alive=false; cancelAnimationFrame(frame); ro?.disconnect(); };
  }, [values.join('\u0001'), style?.fontSize, style?.fontFamily, style?.fontWeight]);
  if (!values.length) return <div className={className} style={style}>Agrega noticias en Content Studio</div>;
  const renderGroup = (clone: boolean) => (
    <div ref={clone ? undefined : firstGroup} aria-hidden={clone} className="stdq-ticker-group">
      {values.map((item, index) => (
        <span className="stdq-ticker-item" key={index}>
          <span className="stdq-ticker-text">{item}</span>
          <span aria-hidden="true" className="stdq-ticker-separator">✦</span>
        </span>
      ))}
    </div>
  );
  return <div className={className} style={{...style, overflow:'hidden', position:'relative', minWidth:0}}>
    <div role="marquee" aria-label={values.join(' · ')} className="stdq-ticker-window">
      <div className={'stdq-ticker-track' + (cycle > 0 ? ' stdq-ticker-measured' : '')}
        style={{
          '--stdq-ticker-distance': `${cycle}px`,
          '--stdq-ticker-duration': `${tickerSeconds(speedSeconds)}s`,
          animationDirection: tickerDirection(direction) === 'right' ? 'reverse' : 'normal',
          animationPlayState: paused ? 'paused' : 'running',
        } as React.CSSProperties}>
        {renderGroup(false)}{renderGroup(true)}
      </div>
    </div>
  </div>;
};
