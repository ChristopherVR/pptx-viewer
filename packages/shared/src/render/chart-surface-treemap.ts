/**
 * View-model builders for surface and treemap chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (surface + treemap)
 *
 * Produces a `ChartViewModel` (SVG primitives only, zero Angular dependencies)
 * that the Angular ChartRendererComponent template iterates over.
 *
 * Surface - isometric projection when the grid has >=2 series and >=2
 *           categories (`chart-surface-isometric.ts`), flat colour-mapped
 *           grid otherwise (`chart-surface-flat.ts`); the shared colour ramp
 *           and chrome helpers live in `chart-surface-common.ts`.
 * Treemap  - slice-and-dice rectangles sorted largest-first with inline
 *            labels (`chart-treemap-view.ts`).
 *
 * This file is a thin barrel: it exists so every existing import of
 * `./chart-surface-treemap` keeps working after the chart-kind builders were
 * split into focused modules to stay under the repo's per-file line budget.
 *
 * @module chart-surface-treemap
 */

export { surfaceColor } from './chart-surface-common';
export { buildSurfaceViewModel } from './chart-surface-flat';
export { buildTreemapViewModel } from './chart-treemap-view';
