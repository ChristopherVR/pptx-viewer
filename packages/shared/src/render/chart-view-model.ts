/**
 * chart-view-model.ts - framework-agnostic SVG-primitive chart engine.
 *
 * A single `buildChartViewModel(element)` projects a chart `PptxElement` into a
 * `ChartViewModel` of pure `SvgPrimitive` descriptors (rect / path / polyline /
 * circle / line / polygon / text). Each binding (React / Vue / Angular) iterates
 * that descriptor list to emit its own SVG; only the EMISSION is per-framework;
 * all geometry / data / palette / layout math lives here.
 *
 * Originally extracted from the Angular `chart-renderer-helpers.ts`, which was
 * itself ported from the React `viewer/utils/chart-*.tsx` renderers. Sibling
 * modules (`chart-combo-stock`, `chart-surface-treemap`, `chart-waterfall-map`,
 * `chart-overlays`) build the advanced chart kinds and overlays on top of the
 * primitives and helpers defined here.
 *
 * Note: this engine's palette helpers (`seriesColor(series, index, palette)`,
 * `paletteColor(index, palette)`) and `DEFAULT_PALETTE` (Office accent set)
 * deliberately differ from the style-id-aware variants in `chart-helpers.ts`
 * (`seriesColor(series, index, styleId?, palette?)`, `DEFAULT_CHART_PALETTE`,
 * tailwind set). They are NOT re-exported through the barrel to avoid name
 * collisions; consume them from this module directly.
 *
 * Supported chart kinds (viewer-first):
 *   bar / column (clustered, stacked, percentStacked) -> bar rects
 *   line / line3D -> polyline + dots
 *   area / area3D -> polygon fill + polyline
 *   pie / doughnut / pie3D / ofPie -> arc paths
 *   scatter -> circle dots
 *   bubble -> circle dots sized by each series' own c:bubbleSize
 *   radar / radar3D -> polar polygons + spokes
 *   combo / stock / surface / treemap / waterfall / regionMap -> sibling modules
 *   funnel / sunburst / histogram / boxWhisker -> sibling modules
 *
 *
 * Deferred (fallback box rendered instead):
 *   bar3D (complex 3-D shading), secondary axes.
 *
 * The engine is split into focused sibling modules and re-exported from here
 * so every existing `./chart-view-model` import keeps working:
 *
 *   chart-view-model-types    descriptor types (primitives, view-model, layout)
 *   chart-view-model-scale    palette, value ranges, axis value formatting
 *   chart-view-model-layout   plot layout, gridlines, labels, legend placement
 *   chart-view-model-bars     bar / column rects, line points
 *   chart-view-model-points   pie, scatter, bubble, radar geometry
 *   chart-view-model-kinds    supported kinds + preserveAspectRatio
 *   chart-view-model-pie      fallback + pie / doughnut builders
 *   chart-view-model-radar    radar builder
 *   chart-view-model-manual   `c:manualLayout` title / legend post-pass
 *   chart-view-model-build    `buildChartViewModel` + shared post-passes
 *
 * @module chart-view-model
 */

export * from './chart-view-model-bars';
export * from './chart-view-model-build';
export * from './chart-view-model-kinds';
export * from './chart-view-model-layout';
export * from './chart-view-model-manual';
export { buildFallbackViewModel, buildPieViewModel } from './chart-view-model-pie';
export * from './chart-view-model-points';
export { buildRadarViewModel } from './chart-view-model-radar';
export * from './chart-view-model-scale';
export * from './chart-view-model-types';
