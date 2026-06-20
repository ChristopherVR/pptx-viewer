/**
 * Framework-agnostic rendering & editing helpers shared by the React, Vue, and
 * Angular `pptx-viewer` bindings. Pure TypeScript (no framework imports) — each
 * binding consumes one copy instead of duplicating it.
 *
 * - geometry:   `shape-geometry` (preset clip-path cascade over core).
 * - fills:      `fill-style` (image/gradient/pattern/solid → CSS).
 * - effects:    `visual-effects` (shadow/glow/reflection/DAG), `image-effects`.
 * - text:       `text-warp` (WordArt paths), `omml-to-mathml` (equations).
 * - charts:     `chart-helpers` (layout/palette/axis math), `chart-trendlines`
 *               (regression overlays).
 * - animation:  `animation-css` (preset → CSS keyframes).
 * - 3d:         `visual-3d` (scene3d/shape3d → CSS transform/shadow pieces).
 * - tables:     `table-style` (cell style + banding → CSS), `table-merge`
 *               (cell merge/split/selection rect math), `table-layout`
 *               (merge-aware row/column insert/delete over `PptxTableData`).
 * - editing:    `element-align` (align/distribute), `element-interaction`
 *               (drag/resize/rotate math).
 * - connectors: `connector-router` (orthogonal A* obstacle-avoiding routing +
 *               SVG path serialisation), `connector-reroute` (dynamic endpoint
 *               recalculation when connected shapes move + connection sites).
 */
export * from './shape-geometry';
export * from './fill-style';
export * from './visual-effects';
export * from './image-effects';
export * from './text-warp';
export * from './omml-to-mathml';
export * from './latex-to-omml';
export * from './chart-helpers';
export * from './chart-trendlines';
export * from './chart-axis';
export * from './chart-palette';
export * from './chart-sparkline';
// SVG-primitive chart engine. Its low-level helpers `ValueRange` / `PlotLayout`
// / `valueToY` / `formatAxisValue` / `computeValueRange` / `seriesColor` /
// `paletteColor` duplicate (with deliberately different signatures) the ones in
// `chart-helpers.ts`, so they are NOT re-exported through the barrel — import
// them from `chart-view-model` directly. The rest of the engine surface is
// safe to flatten here.
export {
	buildChartViewModel,
	buildFallbackViewModel,
	buildGridlinesAndLabels,
	buildZeroLine,
	buildCategoryLabels,
	buildLegend,
	computeStackedValueRange,
	computePlotLayout,
	computeBarRects,
	computeStackedBarRects,
	computeLinePoints,
	linePointsToSvgString,
	computePieSlicePath,
	computePieLayout,
	computePieSlices,
	computeScatterDots,
	computeBubbleRadius,
	radarAngle,
	computeRadarPoints,
	radarRingPoints,
	resolveChartKind,
	DEFAULT_PALETTE,
} from './chart-view-model';
export type {
	ChartViewModel,
	SvgRect,
	SvgPath,
	SvgPolyline,
	SvgCircle,
	SvgLine,
	SvgText,
	SvgPolygon,
	SvgAreaGradient,
	SvgPrimitive,
	LegendEntry,
	BarRect,
	LinePoint,
	PieSliceGeometry,
	ScatterDot,
	RadarPoint,
	SupportedChartKind,
} from './chart-view-model';
export { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';
export { buildSurfaceViewModel, buildTreemapViewModel } from './chart-surface-treemap';
export {
	buildFunnelViewModel,
	buildSunburstViewModel,
	computeFunnelSegments,
	computeSunburstArcs,
} from './chart-funnel-sunburst';
export type { FunnelSegment, SunburstArc } from './chart-funnel-sunburst';
export {
	buildHistogramViewModel,
	buildBoxWhiskerViewModel,
	computeHistogramBars,
	computeBoxStats,
	computeBoxWhiskerGeometry,
} from './chart-distribution';
export type { HistogramBar, BoxStats, BoxWhiskerGeometry } from './chart-distribution';
export {
	buildWaterfallViewModel,
	buildRegionMapViewModel,
	resolveRegionCode,
	sequentialColorScale,
	normalizeValue,
} from './chart-waterfall-map';
export {
	computeTrendlinePrimitives,
	computeErrorBarPrimitives,
	computeAxisTitlePrimitives,
	computeDataTablePrimitives,
	computeLinearRegression,
	fitPolynomial,
	computeRSquared,
	DATA_TABLE_ROW_H,
	DATA_TABLE_HEADER_H,
	DATA_TABLE_KEY_W,
	DATA_TABLE_PADDING,
} from './chart-overlays';
export type { LinearFit } from './chart-overlays';
export * from './animation-css';
// Editor element-animation preset model — distinct from the native OOXML
// `p:timing` timeline below. `animation-authoring` holds the immutable
// slide-`animations[]` patch builders + value-only option catalogs for the
// authoring panel; `animation-playback` holds the pure click-group / reveal /
// pending-style maths that drives the editor preview. Both build on
// `animation-css` for the preset → CSS keyframe mapping. The stateful hooks /
// services / RAF loops stay in each binding.
export * from './animation-authoring';
export * from './animation-playback';
// Native-animation (OOXML `p:timing` tree) timeline engine — preset tables,
// keyframe definitions, colour interpolation, dynamic/static keyframe
// generation, sequencing, click-group timeline + stateful playback controller,
// and editor preview descriptors. Pure maths; the RAF playback loop, DOM style
// injection, audio playback, and file reading stay in each binding.
export * from './animation-timeline-types';
export * from './animation-presets';
export * from './animation-keyframes';
export * from './animation-color';
export * from './animation-timeline-helpers';
export * from './animation-timeline-text-build';
export * from './animation-effects';
export * from './animation-sequencer';
export * from './animation-timeline-builder';
export * from './animation-timeline-engine';
export * from './animation-preview';
// `visual-3d` is the public surface; it re-exports the symbols from its sibling
// modules (`visual-3d-camera`, `visual-3d-materials`, `visual-3d-extrusion`,
// `visual-3d-color`, `visual-3d-constants`), so they are NOT flattened here to
// avoid duplicate-export conflicts.
export * from './visual-3d';
export * from './table-style';
export * from './table-merge';
export * from './table-layout';
export * from './element-align';
export * from './element-interaction';
// Editor snap geometry: snap-to-shape (siblings + guides → snap lines, React/Vue
// model), snap-to-box (closest-per-axis span guides, Angular model), grid
// snapping. Pure maths; the pointer/drag driver stays in each binding.
export * from './snap-guides';
// Ruler tick generation + constants (View ▸ Ruler). Pure; each binding renders.
export * from './ruler';
export * from './bullet-autonum';
export * from './bullet-list';
export * from './text-paragraphs';
export * from './connector-router';
export * from './connector-reroute';
export * from './connector-style';
export * from './format-painter';
export * from './remap-text';
export * from './shape-adjustment';
export * from './hyperlink-security';
export * from './slide-compare';
// Morph (PowerPoint Morph transition) — pure element-matching, SVG-path /
// colour interpolation, text tokenisation, and CSS keyframe generation. The
// DOM injection of the generated keyframes stays in each binding.
export * from './morph-types';
export * from './morph-color';
export * from './morph-svg-path';
export * from './morph-matching';
export * from './morph-text';
export * from './morph-animation';
// Slide-transition (slide-to-slide swap) CSS/keyframe generation — pure mapping
// from a `PptxSlideTransition` to the outgoing/incoming `animation` shorthands
// plus the `@keyframes` strings each binding injects once. Keyframe names use
// the `pptx-tr-*` family (distinct from element-animation `pptx-vue-*` and
// native-timeline `pptx-tl-*`). The DOM overlay + RAF/timer/sound playback
// driver stays in each binding. `p14-transition-*` adds faithful PowerPoint
// 2010 effect keyframes/resolver; the core resolver approximates the same
// exotic types with 2-D fallbacks.
export * from './slide-transition-types';
export * from './slide-transition-keyframes';
export * from './slide-transition-css';
export * from './p14-transition-keyframes';
export * from './p14-transition-css';
// SmartArt SVG-fallback layout engine — pure node geometry/positioning for the
// 10 layout families (list/process/cycle/hierarchy/matrix/radial/pyramid/venn/
// funnel/target), producing fully-styled `RenderedNode` / `RenderedConnector`
// view-models. `smartart-layout` re-exports the geometry types
// (`smartart-layout-types`), helpers, and per-family computers, so a single
// barrel entry exposes the whole surface. Each binding renders the view-models.
export * from './smartart-layout';
// Native file-open picker — framework-agnostic `<input type=file>` helper +
// default `.pptx/.ppsx/.pptm/.potx` accept list, used by every binding's
// File ▸ Open action to load another presentation.
export * from './open-file-picker';
