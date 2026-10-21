import React from 'react';
import type { EditorialComponentConfig } from '../../types';
import { templateLayerProps } from '../../utils/graphicLayers';

/** Content Studio and OBS render this exact same independent logo layer. */
export const BrandLogoLayer: React.FC<{config: EditorialComponentConfig}> = ({ config }) => {
  const brand = config.branding;
  if (!brand?.visible || !brand.assetUrl || config.type === 'logo-bug') return null;
  const edits = templateLayerProps(config, 'brand-logo').style;
  return <img
    data-stdq-layer="brand-logo"
    src={brand.assetUrl}
    alt=""
    draggable={false}
    className="absolute select-none"
    style={{
      ...edits,
      position:'absolute',
      left: brand.x, top: brand.y, width: edits.width ?? brand.width,
      height: 'auto', maxWidth: 'none', objectFit: 'contain',
      opacity: edits.opacity ?? brand.opacity, transform: `rotate(${brand.rotation}deg)`,
      transformOrigin: 'center',
    }}
  />;
};

export const DefaultBranding = {
  assetUrl: '', visible: false, width: 120, x: 16, y: 12, opacity: 1, rotation: 0,
} as const;
