/**
 * chart-overlays.ts: chart overlay depth for Angular pptx-angular-viewer.
 *
 * Pure functions that produce additional `SvgPrimitive[]` / `SvgText[]` for an
 * existing cartesian chart. No Angular dependencies; all inputs are typed
 * against `pptx-viewer-core` and the `SvgPrimitive` union already defined in
 * `chart-renderer-helpers.ts`.
 *
 * The regression math, per-series trendline point computation, trendline
 * primitives builder, and axis-title primitives builder each live in their
 * own module (kept under the repo's file-size guideline); this module
 * re-exports all of it (plus the error-bar primitives) so every existing
 * import of `./chart-overlays` keeps working unchanged.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-trendlines.tsx       (regression engine)
 *   packages/react/src/viewer/utils/chart-overlay-lines.tsx    (error bars)
 *   packages/react/src/viewer/utils/chart-chrome.tsx           (axis titles)
 *   packages/react/src/viewer/utils/chart-data-table.tsx       (data table)
 *   packages/shared/src/render/chart-trendlines.ts             (shared port)
 *
 * @module chart-overlays
 */

export { computeAxisTitlePrimitives } from './chart-overlays-axis-titles';
export { computeErrorBarPrimitives } from './chart-error-bars';
export {
	computeLinearRegression,
	computeRSquared,
	fitPolynomial,
} from './chart-overlays-regression';
export type { LinearFit } from './chart-overlays-regression';
export { computeTrendlinePrimitives } from './chart-overlays-trendline';
