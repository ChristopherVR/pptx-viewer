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
 * - tables:     `table-style` (cell style + banding → CSS).
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
// `visual-3d` is the public surface; it re-exports the symbols from its sibling
// modules (`visual-3d-camera`, `visual-3d-materials`, `visual-3d-extrusion`,
// `visual-3d-color`, `visual-3d-constants`), so they are NOT flattened here to
// avoid duplicate-export conflicts.
export * from './visual-3d';
export * from './table-style';
export * from './element-align';
export * from './element-interaction';
export * from './bullet-autonum';
export * from './bullet-list';
export * from './text-paragraphs';
export * from './connector-router';
export * from './connector-reroute';
export * from './connector-style';
