/**
 * Image-effects CSS layer: thin re-export shim over `pptx-viewer-shared`'s
 * `image-effects`.
 *
 * Maps the parsed `PptxImageEffects` on a picture/image element to a CSS
 * `filter` string (brightness/contrast/saturate/grayscale/biLevel plus CSS-only
 * artistic approximations and `url(#…)` references to SVG `<filter>` defs) and
 * an overall `opacity`. The pure computation lives in shared (consumed
 * identically by Vue/Angular); this module preserves React's historical
 * `getImageEffectsFilter` / `getImageEffectsOpacity` symbol names so existing
 * consumers and colocated tests keep importing unchanged.
 */
export { getImageEffectsFilter, getImageEffectsOpacity } from 'pptx-viewer-shared';
