/**
 * View-model builders for waterfall and regionMap chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-waterfall-combo.tsx  (waterfall only)
 *   packages/react/src/viewer/utils/chart-map.tsx               (regionMap)
 *
 * Produces a `ChartViewModel` (SVG primitives only, zero Angular dependencies)
 * that the Angular ChartRendererComponent template iterates over.
 *
 * Waterfall - running-total bars with positive/negative/total colouring and
 *             dashed connector lines between bars. See `chart-waterfall-view.ts`.
 * RegionMap  - choropleth SVG with simplified world region outlines coloured by
 *              the first data series; unmatched regions fall back to a table.
 *              See `chart-region-map-view.ts` and its supporting modules
 *              (`chart-region-map-alias.ts`, `chart-region-map-colors.ts`,
 *              `chart-region-map-fallback-table.ts`, `chart-map-projection.ts`).
 *
 * This file is a thin barrel: it exists so every existing import of
 * `./chart-waterfall-map` keeps working after the two chart kinds (each with
 * their own supporting helpers) were split into focused modules to stay
 * under the repo's per-file line budget.
 *
 * @module chart-waterfall-map
 */

export { resolveRegionCode } from './chart-region-map-alias';
export { normalizeValue, sequentialColorScale } from './chart-region-map-colors';
export { buildRegionMapViewModel } from './chart-region-map-view';
export { buildWaterfallViewModel } from './chart-waterfall-view';
