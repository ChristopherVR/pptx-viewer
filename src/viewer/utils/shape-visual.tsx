/**
 * shape-visual.tsx — Barrel re-export
 *
 * Implementation split into:
 *   - shape-visual-effects.ts   — getImageEffectsFilter, getImageEffectsOpacity
 *   - shape-visual-filters.tsx  — duotone SVG filters, line effects, DAG helpers
 *   - shape-visual-3d.ts        — apply3dEffects (internal helper)
 *   - shape-visual-style.ts     — getShapeVisualStyle
 */
export {
  getImageEffectsFilter,
  getImageEffectsOpacity,
} from "./shape-visual-effects";

export {
  getDuotoneFilterId,
  renderDuotoneSvgFilter,
  hasDuotoneEffect,
  getDuotoneColors,
  buildLineShadowCss,
  buildLineGlowFilter,
  getDagDuotoneFilterId,
  hasDagDuotoneEffect,
  renderDagDuotoneSvgFilter,
} from "./shape-visual-filters";

export { getShapeVisualStyle } from "./shape-visual-style";
