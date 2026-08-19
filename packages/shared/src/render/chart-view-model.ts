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
 * Supported chart kinds (viewer-first):
 *   bar / column (clustered, stacked, percentStacked) -> bar rects
 *   line / line3D -> polyline + dots
 *   area / area3D -> polygon fill + polyline
 *   pie / doughnut / pie3D / ofPie -> arc paths
 *   scatter -> circle dots
 *   bubble -> circle dots sized by each series' own c:bubbleSize
 *   radar / radar3D -> polar polygons + spokes
 *
 * Deferred (fallback box rendered instead):
 *   bar3D (complex 3-D shading), secondary axes.
 *
 * @module chart-view-model
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type {
	ChartPptxElement,
	PptxChartData,
	PptxChartSeries,
	PptxElement,
} from 'pptx-viewer-core';

import { applyChart3DDepth } from './chart-3d-depth';
import { DEFAULT_CHART_AREA_FILL, chartAreaFill, plotAreaFill } from './chart-area-fill';
import { niceValueAxisBounds } from './chart-axis-nice';
import { buildCartesianViewModel } from './chart-cartesian';
import { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointExplosion, resolveVaryColorFill } from './chart-datapoint-style';
import { buildBoxWhiskerViewModel, buildHistogramViewModel } from './chart-distribution';
import { chartFontPx, DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX } from './chart-font';
import { buildFunnelViewModel, buildSunburstViewModel } from './chart-funnel-sunburst';
import { DEFAULT_CHART_PALETTE } from './chart-helpers';
import { formatChartNumber } from './chart-number-format';
import { buildOfPieViewModel } from './chart-ofpie';
import { buildPieDataLabels } from './chart-pie-labels';
import { buildSurfaceViewModel, buildTreemapViewModel } from './chart-surface-treemap';
import { buildChartUserShapeOverlay } from './chart-user-shape-overlay';
import { buildRegionMapViewModel, buildWaterfallViewModel } from './chart-waterfall-map';

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default Office accent palette (accent1-accent6 plus the two chart extras).
 *
 * An alias of `DEFAULT_CHART_PALETTE` (chart-helpers.ts), on purpose: the two
 * shared entry points used to carry different fallback palettes, so the same
 * unstyled chart painted Office accents in one binding and a Tailwind-ish set
 * in another depending on which helper its renderer imported.
 */
export const DEFAULT_PALETTE: readonly string[] = DEFAULT_CHART_PALETTE;

/** Return the palette colour for an index, preferring a parsed colour palette. */
export function paletteColor(index: number, colorPalette: readonly string[] | undefined): string {
	const pal = colorPalette && colorPalette.length > 0 ? colorPalette : DEFAULT_PALETTE;
	return pal[index % pal.length];
}

/**
 * Resolve a series' colour, preferring the series' own `color` property, then
 * its marker fill (scatter series often author `a:ln/a:noFill` on the series
 * and put the colour on `c:marker/c:spPr`; the points paint that fill, so the
 * legend swatch must match it), then the palette.
 */
export function seriesColor(
	series: PptxChartSeries,
	index: number,
	colorPalette: readonly string[] | undefined,
): string {
	return series.color ?? series.marker?.spPr?.fillColor ?? paletteColor(index, colorPalette);
}

// ─────────────────────────────────────────────────────────────────────────────
// Value range
// ─────────────────────────────────────────────────────────────────────────────

/** Min/max/span of a value axis. */
export interface ValueRange {
	min: number;
	max: number;
	span: number;
	/** When true, the range is log-scaled (min/max are data-space power-of-base bounds, span is in log-space). */
	logScale?: boolean;
	/** Logarithmic base (e.g. 10, 2, Math.E). Only meaningful when logScale is true. */
	logBase?: number;
	/** Whether values increase from top to bottom. */
	reverseOrder?: boolean;
	/**
	 * Step between major gridlines when the bounds came from the automatic
	 * scale. See the same field on `ValueRange` in `chart-helpers.ts`.
	 */
	majorUnit?: number;
}

/**
 * Automatic Y-axis range, on PowerPoint's terms. See `chart-axis-nice.ts`; this
 * mirrors `computeValueRange` in `chart-helpers.ts`.
 */
export function computeValueRange(series: ReadonlyArray<PptxChartSeries>): ValueRange {
	let dataMin = Number.POSITIVE_INFINITY,
		dataMax = Number.NEGATIVE_INFINITY;
	for (const item of series) {
		for (const value of item.values) {
			if (value < dataMin) {
				dataMin = value;
			}
			if (value > dataMax) {
				dataMax = value;
			}
		}
	}
	if (dataMin === Number.POSITIVE_INFINITY) {
		return { min: 0, max: 1, span: 1 };
	}
	const { min, max, majorUnit } = niceValueAxisBounds(dataMin, dataMax);
	return { min, max, span: Math.max(max - min, Number.EPSILON), majorUnit };
}

/**
 * Value range for a stacked bar: the per-category sums, then the same automatic
 * scale as any other value axis.
 */
export function computeStackedValueRange(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
): ValueRange {
	let maxSum = 0,
		minSum = 0;
	for (let ci = 0; ci < catCount; ci++) {
		let pos = 0,
			neg = 0;
		for (const s of series) {
			const v = s.values[ci] ?? 0;
			if (v >= 0) {
				pos += v;
			} else {
				neg += v;
			}
		}
		maxSum = Math.max(maxSum, pos);
		minSum = Math.min(minSum, neg);
	}
	const { min, max, majorUnit } = niceValueAxisBounds(Math.min(minSum, 0), Math.max(maxSum, 0));
	return { min, max, span: Math.max(max - min, Number.EPSILON), majorUnit };
}

/**
 * Map a data value to a Y pixel coordinate (top = max, bottom = min).
 * Routes through logarithmic scaling when `range.logScale` is set (the branch is
 * inlined here, mirroring `valueToYLog` in `chart-axis.ts`, to avoid a circular
 * import). Linear behaviour is unchanged when `logScale`/`logBase` are absent.
 */
export function valueToY(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	let ratio: number;
	if (range.logScale && range.logBase) {
		const base = range.logBase,
			clampedVal = Math.max(val, range.min),
			logVal = Math.log(clampedVal) / Math.log(base),
			logMin = Math.log(range.min) / Math.log(base);
		ratio = (logVal - logMin) / range.span;
	} else {
		ratio = (val - range.min) / range.span;
	}
	return range.reverseOrder ? topY + ratio * usable : bottomY - ratio * usable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a numeric axis or data label to a short human-readable string, or
 * through the chart's own `c:numFmt/@formatCode` when it declares one. See
 * `formatAxisValue` in `chart-helpers.ts`, which this mirrors.
 */
export function formatAxisValue(val: number, formatCode?: string): string {
	const formatted = formatChartNumber(val, formatCode);
	if (formatted !== undefined) {
		return formatted;
	}
	if (Math.abs(val) >= 1_000_000) {
		return `${(val / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(val) >= 1_000) {
		return `${(val / 1_000).toFixed(1)}K`;
	}
	if (Number.isInteger(val)) {
		return String(val);
	}
	return val.toFixed(1);
}

/**
 * Build the hover-tooltip text for a plain data mark (bar / line / area /
 * scatter / bubble / pie / radar point), projected as each primitive's `title`
 * field (see the doc comment on `SvgPath.title`).
 *
 * Mirrors the region map's own `"<name>: <value>"` tooltip (chart-waterfall-map.ts):
 * join whichever of the series name and category/point label are known, then
 * append the formatted value. Either label may be absent (a scatter/bubble
 * point has no category; an un-named series has no name); the result degrades
 * to just the value when neither is.
 */
export function buildMarkTooltip(
	seriesName: string | undefined,
	categoryLabel: string | undefined,
	value: number,
	numberFormat?: string,
): string {
	const label = [seriesName, categoryLabel]
			.filter((part): part is string => Boolean(part && part.length > 0))
			.join(', '),
		formatted = formatAxisValue(value, numberFormat);
	return label.length > 0 ? `${label}: ${formatted}` : formatted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plot layout
// ─────────────────────────────────────────────────────────────────────────────

/** Bounding-box of the chart's usable plot area in SVG coordinates. */
export interface PlotLayout {
	svgWidth: number;
	svgHeight: number;
	plotLeft: number;
	plotTop: number;
	plotRight: number;
	plotBottom: number;
	plotWidth: number;
	plotHeight: number;
}

/**
 * Reserved-space options for `computePlotLayout` (secondary axes + data table).
 * Structurally identical to `LayoutOptions` in `chart-axis.ts`; declared locally
 * to avoid a circular import (chart-axis depends on this module's `ValueRange`).
 */
export interface PlotLayoutOptions {
	hasSecondaryValueAxis?: boolean;
	hasSecondaryCategoryAxis?: boolean;
	hasDataTable?: boolean;
	dataTableRowCount?: number;
}

/**
 * Compute the plot layout for a chart element.
 * Mirrors `computeLayout` from chart-layout.ts (React). When `options` is omitted
 * (or all its flags are falsy) the output is byte-identical to the original
 * viewer-first single-axis layout; the secondary-axis / data-table reservations
 * only apply when explicitly requested.
 */
/**
 * Vertical space to reserve under the plot for the category axis: the gap
 * `c:lblOffset` asks for, plus one line box of the axis font.
 *
 * The old flat 24 px was calibrated when chart text was drawn pt-as-px. Once
 * `chartFontPx` scaled every label by 4/3, an 11.95 pt axis no longer fitted in
 * 24 px and its labels were pushed back up onto the plot. The `Math.max(24, …)`
 * floor keeps the previous behaviour for default-font and axis-less charts, so
 * only oversized-font charts move.
 *
 * @param chartData The chart whose category axis is being measured.
 * @returns Pixels to reserve below the plot area.
 */
function categoryAxisBand(chartData: PptxChartData): number {
	const axis = chartData.axes?.find(
			(candidate) => candidate.axisType === 'catAx' || candidate.axisType === 'dateAx',
		),
		fontPx = axis?.fontSize !== undefined ? chartFontPx(axis.fontSize) : DEFAULT_CHART_TEXT_PX,
		offset = 4 + 8 * ((axis?.labelOffset ?? 100) / 100);
	return Math.max(24, offset + fontPx * 1.2);
}

export function computePlotLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	hasAxes: boolean,
	options?: PlotLayoutOptions,
): PlotLayout {
	// The SVG viewBox must equal the element's frame box exactly: bindings render
	// it with `preserveAspectRatio="none"`, so ANY minimum here (historically
	// 320x180) makes the chart scale non-uniformly inside its host (issue #132:
	// a 475x174 frame got a 475x180 viewBox, squeezing y by 0.967).
	const svgWidth = Math.max(1, elementWidth),
		svgHeight = Math.max(1, elementHeight);

	let plotLeft = hasAxes ? 48 : 8,
		plotTop = 8,
		plotRight = svgWidth - 8,
		plotBottom = svgHeight - (hasAxes ? categoryAxisBand(chartData) : 8);

	const style = chartData.style,
		legendPos = style?.legendPosition ?? 'b';

	if (style?.hasTitle) {
		plotTop += 20;
	}
	if (style?.hasLegend) {
		if (legendPos === 'b') {
			plotBottom -= 20;
		} else if (legendPos === 't') {
			plotTop += 20;
		} else if (legendPos === 'r') {
			plotRight -= 80;
		} else if (legendPos === 'l') {
			plotLeft += 80;
		}
	}

	// Secondary value axis on the right.
	if (options?.hasSecondaryValueAxis) {
		plotRight -= 40;
	}
	// Secondary category axis on the top.
	if (options?.hasSecondaryCategoryAxis) {
		plotTop += 16;
	}
	// Data table below the chart.
	if (options?.hasDataTable) {
		const rowCount = options.dataTableRowCount ?? 1;
		plotBottom -= 14 + rowCount * 14;
	}

	const plotWidth = Math.max(plotRight - plotLeft, 1),
		plotHeight = Math.max(plotBottom - plotTop, 1);

	return {
		svgWidth,
		svgHeight,
		plotLeft,
		plotTop,
		plotRight: plotLeft + plotWidth,
		plotBottom: plotTop + plotHeight,
		plotWidth,
		plotHeight,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive chart parts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reference to an interactive chart sub-part, carried by the primitives that
 * represent data marks (bars, dots, slices, series lines). Bindings use it to
 * make marks clickable/draggable in edit mode and to sync selection with the
 * chart inspector; primitives without a `part` stay purely decorative.
 */
export interface ChartPartRef {
	/** 'dataPoint' targets one (series, category) cell; 'series' the whole series. */
	role: 'dataPoint' | 'series';
	seriesIndex: number;
	/** Category/point index. Absent when the primitive spans the whole series. */
	pointIndex?: number;
}

/**
 * Vertical drag-to-value context, present on cartesian view-models whose data
 * marks can be dragged vertically to change their value (clustered bar, line,
 * scatter, bubble). `secondarySeriesIndexes` lists series plotted against
 * `secondaryRange` instead of `range`.
 */
export interface ChartValueDrag {
	range: ValueRange;
	secondaryRange?: ValueRange;
	secondarySeriesIndexes?: number[];
	plotTop: number;
	plotBottom: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG primitive descriptors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hover tooltip / accessible name, projected as each primitive's SVG `<title>`
 * child. Every primitive kind that can represent a data mark (rect, path,
 * polyline, circle, line, polygon) carries this field so any chart mark, not
 * just the region map's choropleth patches, can surface a tooltip. Projectors
 * that ignore the field simply render no tooltip.
 */
export interface SvgRect {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	rx?: number;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgPath {
	kind: 'path';
	d: string;
	fill: string;
	stroke?: string;
	strokeWidth?: number;
	opacity?: number;
	part?: ChartPartRef;
	/**
	 * Hover tooltip / accessible name, projected as an SVG `<title>` child.
	 *
	 * The region map (chart-waterfall-map.ts) was the first to set it: a
	 * choropleth patch carries no label of its own, so without a tooltip the
	 * reader cannot tell which region a colour belongs to. Every other primitive
	 * kind now carries the same field for the same reason on the mainstream chart
	 * kinds (bar / line / area / scatter / bubble / pie / radar). Projectors that
	 * ignore the field simply render no tooltip.
	 */
	title?: string;
}

export interface SvgPolyline {
	kind: 'polyline';
	points: string;
	stroke: string;
	strokeWidth: number;
	fill: string;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgCircle {
	kind: 'circle';
	cx: number;
	cy: number;
	r: number;
	fill: string;
	opacity?: number;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgLine {
	kind: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	stroke: string;
	strokeWidth: number;
	dashArray?: string;
	opacity?: number;
	title?: string;
}

export interface SvgText {
	kind: 'text';
	x: number;
	y: number;
	text: string;
	fontSize: number;
	fill: string;
	textAnchor: 'start' | 'middle' | 'end';
	fontWeight?: 'normal' | 'bold';
	fontFamily?: string;
	dominantBaseline?: string;
	opacity?: number;
	/** Optional SVG transform (e.g. `rotate(-90, x, y)` for a vertical axis title). */
	transform?: string;
}

export interface SvgPolygon {
	kind: 'polygon';
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity?: number;
	dashArray?: string;
	part?: ChartPartRef;
	title?: string;
}

export interface SvgAreaGradient {
	kind: 'areaGradient';
	id: string;
	color: string;
}

export type SvgPrimitive =
	| SvgRect
	| SvgPath
	| SvgPolyline
	| SvgCircle
	| SvgLine
	| SvgPolygon
	| SvgText
	| SvgAreaGradient;

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

export interface LegendEntry {
	color: string;
	label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full chart view-model
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartViewModel {
	svgWidth: number;
	svgHeight: number;
	title: string | undefined;
	titleX: number;
	titleY: number;
	gridlines: SvgLine[];
	axisLabels: SvgText[];
	zeroLine: SvgLine | undefined;
	categoryLabels: SvgText[];
	primitives: SvgPrimitive[];
	dataLabels: SvgText[];
	legend: LegendEntry[];
	legendX: number;
	legendY: number;
	legendAnchor: 'start' | 'middle' | 'end';
	/**
	 * Right-side (secondary) value-axis gridlines, emitted only when one or more
	 * series are mapped to a secondary value axis. Absent otherwise so existing
	 * projectors that ignore this field keep working unchanged.
	 */
	secondaryGridlines?: SvgLine[];
	/** Right-side (secondary) value-axis tick labels. Present only with a secondary axis. */
	secondaryAxisLabels?: SvgText[];
	/**
	 * SVG `fill` for the full-bleed chart-area rect, resolved from
	 * `c:chartSpace/c:spPr`. `undefined` means the chart declared `a:noFill` and
	 * NOTHING should be painted behind it. See `chart-area-fill.ts`.
	 */
	areaFill?: string;
	/**
	 * SVG `fill` for the plot-area rect, resolved from `c:plotArea/c:spPr`.
	 * `undefined` means paint nothing and let the chart area show through.
	 */
	plotFill?: string;
	/**
	 * Overlay primitives (regression trendlines, error bars, axis titles) layered
	 * on top of the base cartesian primitives. Already appended to `primitives`;
	 * surfaced separately so a projector can style/segregate them if desired.
	 */
	overlays?: SvgPrimitive[];
	/**
	 * Data-table primitives rendered below the plot area (when `chartData.dataTable`
	 * is set). Already appended to `primitives`; surfaced separately for projectors.
	 */
	dataTable?: SvgPrimitive[];
	/**
	 * Present when the chart's data marks support vertical drag-to-value editing
	 * (clustered bar / line / scatter / bubble). Absent for stacked, polar, and
	 * hierarchical kinds, where a vertical drag has no single-value meaning.
	 */
	valueDrag?: ChartValueDrag;
	/**
	 * Drawing-overlay primitives resolved from the chart's `c:userShapes`
	 * (shapes/text drawn on top of the plot). Already appended to `primitives`;
	 * surfaced separately so projectors can segregate them if desired. Absent
	 * when the chart has no overlay.
	 */
	userShapes?: SvgPrimitive[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome helpers
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDLINE_COLOR = '#e2e8f0';
export const AXIS_LABEL_COLOR = '#64748b';
export const ZERO_LINE_COLOR = '#94a3b8';
const TICK_COUNT = 5;

/**
 * Tick values for a range: one per major unit when the automatic scale supplied
 * one (it snapped the bounds to whole multiples, so this lands on round numbers
 * exactly as PowerPoint does), otherwise an even division of the span.
 * Exported for the transposed (horizontal-bar) axis builder.
 */
export function axisTickValues(range: ValueRange): number[] {
	const unit = range.majorUnit;
	if (unit !== undefined && Number.isFinite(unit) && unit > 0 && !range.logScale) {
		const steps = Math.round((range.max - range.min) / unit);
		if (steps >= 1 && steps <= 100) {
			return Array.from({ length: steps + 1 }, (_unused, index) => range.min + unit * index);
		}
	}
	return Array.from(
		{ length: TICK_COUNT + 1 },
		(_unused, index) => range.min + (range.span / TICK_COUNT) * index,
	);
}

export function buildGridlinesAndLabels(
	range: ValueRange,
	layout: PlotLayout,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [],
		axisLabels: SvgText[] = [];

	for (const val of axisTickValues(range)) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);

		gridlines.push({
			kind: 'line',
			x1: layout.plotLeft,
			y1: y,
			x2: layout.plotRight,
			y2: y,
			stroke: GRIDLINE_COLOR,
			strokeWidth: 1,
		});

		axisLabels.push({
			kind: 'text',
			x: layout.plotLeft - 4,
			y,
			text: formatAxisValue(val),
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'end',
			dominantBaseline: 'central',
		});
	}

	return { gridlines, axisLabels };
}

export function buildZeroLine(range: ValueRange, layout: PlotLayout): SvgLine | undefined {
	if (range.min >= 0 || range.max <= 0) {
		return undefined;
	}
	const y = valueToY(0, range, layout.plotTop, layout.plotBottom);
	return {
		kind: 'line',
		x1: layout.plotLeft,
		y1: y,
		x2: layout.plotRight,
		y2: y,
		stroke: ZERO_LINE_COLOR,
		strokeWidth: 1,
	};
}

export function buildCategoryLabels(
	categoryLabels: ReadonlyArray<string>,
	layout: PlotLayout,
	catSpacing: 'bar' | 'line',
): SvgText[] {
	const catCount = Math.max(categoryLabels.length, 1);
	return categoryLabels.map((label, i) => {
		const x =
			catSpacing === 'bar'
				? layout.plotLeft + (layout.plotWidth / catCount) * (i + 0.5)
				: catCount > 1
					? layout.plotLeft + (layout.plotWidth / (catCount - 1)) * i
					: layout.plotLeft + layout.plotWidth / 2;
		return {
			kind: 'text',
			x,
			y: layout.plotBottom + 12,
			text: label,
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'middle',
		} satisfies SvgText;
	});
}

export function buildLegend(
	series: ReadonlyArray<PptxChartSeries>,
	colorPalette: readonly string[] | undefined,
	svgWidth: number,
	legendPos: string,
	svgHeight: number,
	plotTop: number,
): {
	legend: LegendEntry[];
	legendX: number;
	legendY: number;
	legendAnchor: 'start' | 'middle' | 'end';
} {
	const legend: LegendEntry[] = series.map((s, i) => ({
		color: seriesColor(s, i, colorPalette),
		label: s.name,
	}));

	let legendX = svgWidth / 2,
		legendY = svgHeight - 8,
		legendAnchor: 'start' | 'middle' | 'end' = 'middle';

	if (legendPos === 'r') {
		legendX = svgWidth - 75;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (legendPos === 'l') {
		legendX = 4;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (legendPos === 't') {
		legendY = 28;
	}

	return { legend, legendX, legendY, legendAnchor };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar / column
// ─────────────────────────────────────────────────────────────────────────────

export interface BarRect {
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	/** Source series index, carried so plot builders can tag interactive parts. */
	seriesIndex?: number;
	/** Source category index, carried so plot builders can tag interactive parts. */
	pointIndex?: number;
}

export function computeBarRects(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	colorPalette: readonly string[] | undefined,
): BarRect[] {
	const rects: BarRect[] = [],
		seriesCount = Math.max(series.length, 1),
		barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
		singleBarWidth = (barGroupWidth * 0.7) / seriesCount,
		groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

	for (let ci = 0; ci < catCount; ci++) {
		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[ci] ?? 0,
				x = layout.plotLeft + barGroupWidth * ci + groupOffset + singleBarWidth * si,
				zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom),
				valY = valueToY(val, range, layout.plotTop, layout.plotBottom),
				y = Math.min(zeroY, valY),
				h = Math.max(Math.abs(zeroY - valY), 1);
			rects.push({
				x,
				y,
				w: singleBarWidth,
				h,
				fill: seriesColor(series[si], si, colorPalette),
			});
		}
	}
	return rects;
}

export function computeStackedBarRects(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	colorPalette: readonly string[] | undefined,
): BarRect[] {
	const rects: BarRect[] = [],
		barW = (layout.plotWidth / Math.max(catCount, 1)) * 0.7,
		barOffset = (layout.plotWidth / Math.max(catCount, 1) - barW) / 2,
		zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);

	for (let ci = 0; ci < catCount; ci++) {
		let posTop = zeroY,
			negBottom = zeroY;

		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[ci] ?? 0;
			if (val === 0) {
				continue;
			}
			const x = layout.plotLeft + (layout.plotWidth / Math.max(catCount, 1)) * ci + barOffset,
				h = Math.max(
					Math.abs(
						valueToY(val, range, layout.plotTop, layout.plotBottom) -
							valueToY(0, range, layout.plotTop, layout.plotBottom),
					),
					1,
				);
			if (val > 0) {
				const y = posTop - h;
				rects.push({
					x,
					y,
					w: barW,
					h,
					fill: seriesColor(series[si], si, colorPalette),
					seriesIndex: si,
					pointIndex: ci,
				});
				posTop = y;
			} else {
				const y = negBottom;
				rects.push({
					x,
					y,
					w: barW,
					h,
					fill: seriesColor(series[si], si, colorPalette),
					seriesIndex: si,
					pointIndex: ci,
				});
				negBottom = y + h;
			}
		}
	}
	return rects;
}

// ─────────────────────────────────────────────────────────────────────────────
// Line / area
// ─────────────────────────────────────────────────────────────────────────────

export interface LinePoint {
	x: number;
	y: number;
}

export function computeLinePoints(
	values: ReadonlyArray<number>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
): LinePoint[] {
	const n = Math.max(catCount, 2);
	return values.map((val, i) => {
		const nx = n > 1 ? i / (n - 1) : 0,
			x = layout.plotLeft + layout.plotWidth * nx,
			y = valueToY(val, range, layout.plotTop, layout.plotBottom);
		return { x, y };
	});
}

export function linePointsToSvgString(points: ReadonlyArray<LinePoint>): string {
	return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pie / doughnut
// ─────────────────────────────────────────────────────────────────────────────

export interface PieSliceGeometry {
	d: string;
	midAngle: number;
	labelX: number;
	labelY: number;
}

export function computePieSlicePath(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	startAngle: number,
	endAngle: number,
): PieSliceGeometry {
	const largeArc = endAngle - startAngle > Math.PI ? 1 : 0,
		x1 = cx + outerR * Math.cos(startAngle),
		y1 = cy + outerR * Math.sin(startAngle),
		x2 = cx + outerR * Math.cos(endAngle),
		y2 = cy + outerR * Math.sin(endAngle);

	let d: string;
	if (innerR > 0) {
		const ix1 = cx + innerR * Math.cos(startAngle),
			iy1 = cy + innerR * Math.sin(startAngle),
			ix2 = cx + innerR * Math.cos(endAngle),
			iy2 = cy + innerR * Math.sin(endAngle);
		d = `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`;
	} else {
		d = `M${cx},${cy} L${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} Z`;
	}

	const midAngle = (startAngle + endAngle) / 2,
		labelR = outerR * 0.7,
		labelX = cx + labelR * Math.cos(midAngle),
		labelY = cy + labelR * Math.sin(midAngle);

	return { d, midAngle, labelX, labelY };
}

export function computePieLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	isDoughnut: boolean,
): { cx: number; cy: number; outerR: number; innerR: number; size: number } {
	const size = Math.min(Math.max(elementWidth, 1), Math.max(elementHeight, 1)),
		titleOffset = chartData.style?.hasTitle ? 20 : 0,
		legendOffset = chartData.style?.hasLegend ? 20 : 0,
		cx = size / 2,
		cy = titleOffset + (size - titleOffset - legendOffset) / 2,
		outerR = Math.max((size - titleOffset - legendOffset) * 0.42, 0),
		// Honour c:holeSize (10-90% of the outer diameter) when parsed; otherwise
		// keep the legacy 0.55 ratio byte-for-byte.
		holeRatio =
			isDoughnut && chartData.doughnutHoleSize !== undefined
				? Math.min(Math.max(chartData.doughnutHoleSize, 10), 90) / 100
				: 0.55,
		innerR = isDoughnut ? outerR * holeRatio : 0;
	return { cx, cy, outerR, innerR, size };
}

/** Options for {@link computePieSlices}: start-angle rotation and per-slice explosion. */
export interface PieSliceOptions {
	/** Absolute start angle (radians). Defaults to -PI/2 (12 o'clock). */
	startAngle?: number;
	/** Per-slice pull-out distance as a percentage of the outer radius (0-100). */
	explosions?: ReadonlyArray<number>;
}

export function computePieSlices(
	values: ReadonlyArray<number>,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	options?: PieSliceOptions,
): PieSliceGeometry[] {
	const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
	let cumAngle = options?.startAngle ?? -Math.PI / 2;
	return values.map((val, i) => {
		const sliceAngle = (Math.abs(val) / total) * Math.PI * 2,
			startAngle = cumAngle;
		cumAngle += sliceAngle;
		// A c:explosion pulls the slice outward along its bisector.
		const explosion = options?.explosions?.[i] ?? 0;
		if (explosion > 0) {
			const mid = (startAngle + cumAngle) / 2,
				offset = outerR * (explosion / 100);
			return computePieSlicePath(
				cx + Math.cos(mid) * offset,
				cy + Math.sin(mid) * offset,
				outerR,
				innerR,
				startAngle,
				cumAngle,
			);
		}
		return computePieSlicePath(cx, cy, outerR, innerR, startAngle, cumAngle);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Scatter
// ─────────────────────────────────────────────────────────────────────────────

export interface ScatterDot {
	cx: number;
	cy: number;
}

/**
 * The x extent a scatter / bubble plot is drawn against.
 *
 * Every `CT_ScatterSer` / `CT_BubbleSer` carries its own `c:xVal`, so the
 * domain has to be computed ACROSS series before any of them is projected;
 * letting each series derive its own min/span would stretch every series to
 * fill the plot and destroy the relationship between them.
 */
export interface ScatterXDomain {
	min: number;
	span: number;
}

/**
 * Union x domain of several series' x values. Returns `undefined` when no
 * series declares a finite x value, in which case callers fall back to
 * positioning points by index.
 */
export function computeScatterXDomain(
	seriesXValues: ReadonlyArray<ReadonlyArray<number> | undefined>,
): ScatterXDomain | undefined {
	const finite: number[] = [];
	for (const values of seriesXValues) {
		for (const value of values ?? []) {
			if (Number.isFinite(value)) {
				finite.push(value);
			}
		}
	}
	if (finite.length === 0) {
		return undefined;
	}
	const min = Math.min(...finite);
	return { min, span: Math.max(Math.max(...finite) - min, 1) };
}

export function computeScatterDots(
	values: ReadonlyArray<number>,
	maxXIndex: number,
	layout: PlotLayout,
	range: ValueRange,
	xValues?: ReadonlyArray<number>,
	xDomain?: ScatterXDomain,
): ScatterDot[] {
	const finiteX = xValues?.slice(0, values.length).filter(Number.isFinite),
		minX = xDomain ? xDomain.min : finiteX?.length ? Math.min(...finiteX) : 0,
		spanX = xDomain
			? xDomain.span
			: finiteX?.length
				? Math.max(Math.max(...finiteX) - minX, 1)
				: maxXIndex;
	return values.map((val, i) => ({
		cx:
			layout.plotLeft +
			(spanX > 0 ? (Number.isFinite(xValues?.[i]) ? xValues![i] - minX : i) / spanX : 0) *
				layout.plotWidth,
		cy: valueToY(val, range, layout.plotTop, layout.plotBottom),
	}));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Radius of a bubble given its size value, the max size in the chart, and a
 * median radius derived from the plot area. Mirrors `renderBubbleChart` in
 * React's chart-scatter-bubble.tsx: when no size value is present the bubble
 * uses the median radius; otherwise it scales from 0.5x to 2x the median.
 */
export function computeBubbleRadius(
	sizeVal: number | undefined,
	maxBubble: number,
	medianRadius: number,
): number {
	if (sizeVal === undefined) {
		return medianRadius;
	}
	const denom = maxBubble > 0 ? maxBubble : 1;
	return medianRadius * 0.5 + (Math.abs(sizeVal) / denom) * medianRadius * 1.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar
// ─────────────────────────────────────────────────────────────────────────────

/** Angle (radians) of the i-th radar spoke; 0 points up (-90°), clockwise. */
export function radarAngle(index: number, catCount: number): number {
	const n = Math.max(catCount, 1);
	return (Math.PI * 2 * index) / n - Math.PI / 2;
}

export interface RadarPoint {
	x: number;
	y: number;
}

/** Project a series' values onto radar (polar) coordinates around (cx, cy). */
export function computeRadarPoints(
	values: ReadonlyArray<number>,
	maxVal: number,
	radius: number,
	cx: number,
	cy: number,
	catCount: number,
): RadarPoint[] {
	const denom = maxVal > 0 ? maxVal : 1;
	return values.slice(0, Math.max(catCount, 1)).map((val, i) => {
		const angle = radarAngle(i, catCount),
			r = (Math.abs(val) / denom) * radius;
		return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
	});
}

/** Points string for a radar gridline ring at radius `rr`. */
export function radarRingPoints(cx: number, cy: number, rr: number, catCount: number): string {
	const n = Math.max(catCount, 1);
	return Array.from({ length: n }, (_, i) => {
		const angle = radarAngle(i, n);
		return `${(cx + rr * Math.cos(angle)).toFixed(2)},${(cy + rr * Math.sin(angle)).toFixed(2)}`;
	}).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Supported chart kinds
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedChartKind =
	| 'bar'
	| 'line'
	| 'area'
	| 'pie'
	| 'doughnut'
	| 'scatter'
	| 'bubble'
	| 'radar'
	| 'combo'
	| 'stock'
	| 'surface'
	| 'treemap'
	| 'waterfall'
	| 'regionMap'
	| 'funnel'
	| 'sunburst'
	| 'histogram'
	| 'boxWhisker';

/**
 * The `preserveAspectRatio` a chart kind's `<svg>` must carry.
 *
 * Cartesian charts stretch to fill the element box (`none`); the kinds whose
 * geometry is round or laid out on a fixed-ratio canvas (pie, doughnut, radar,
 * and the region map's 1000x500 world outline) keep their proportions instead.
 *
 * A pure decision function because all five bindings need the same answer and
 * four of them had written their own copy of the `kind === 'pie' || ...` chain;
 * one of the copies (React's) disagreed with the rest.
 */
export function chartPreserveAspectRatio(
	kind: SupportedChartKind | 'unsupported',
): 'none' | 'xMidYMid meet' {
	return kind === 'pie' || kind === 'doughnut' || kind === 'radar' || kind === 'regionMap'
		? 'xMidYMid meet'
		: 'none';
}

export function resolveChartKind(chartType: string): SupportedChartKind | 'unsupported' {
	switch (chartType) {
		case 'bar':
		case 'bar3D':
			return 'bar';
		case 'line':
		case 'line3D':
			return 'line';
		case 'area':
		case 'area3D':
			return 'area';
		case 'pie':
		case 'pie3D':
		case 'ofPie':
			return 'pie';
		case 'doughnut':
			return 'doughnut';
		case 'scatter':
			return 'scatter';
		case 'bubble':
			return 'bubble';
		case 'radar':
		case 'radar3D':
			return 'radar';
		case 'combo':
			return 'combo';
		case 'stock':
			return 'stock';
		case 'surface':
		case 'surface3D':
			return 'surface';
		case 'treemap':
			return 'treemap';
		case 'waterfall':
			return 'waterfall';
		case 'regionMap':
			return 'regionMap';
		case 'funnel':
			return 'funnel';
		case 'sunburst':
			return 'sunburst';
		case 'histogram':
			return 'histogram';
		case 'boxWhisker':
			return 'boxWhisker';
		default:
			return 'unsupported';
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view-model builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildChartViewModel(element: PptxElement): ChartViewModel {
	if (element.type !== 'chart') {
		return buildFallbackViewModel(element.width, element.height, 'Chart');
	}
	const chartEl = element as ChartPptxElement,
		chartData = chartEl.chartData;

	if (!chartData || chartData.series.length === 0) {
		return buildFallbackViewModel(element.width, element.height, chartData?.title ?? 'Chart');
	}

	const chartType = chartData.chartType ?? 'bar',
		kind = resolveChartKind(chartType);

	if (kind === 'unsupported') {
		return buildFallbackViewModel(element.width, element.height, chartData.title ?? chartType);
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0),
		categoryLabels =
			chartData.categories.length > 0
				? chartData.categories
				: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	// Pie-of-pie / bar-of-pie splits one series across a primary + secondary plot.
	if (chartType === 'ofPie') {
		return withChartAreaFill(
			withUserShapeOverlay(buildOfPieViewModel(element, chartData, categoryLabels), chartData),
			chartData,
		);
	}

	// 3D chart kinds keep their flat geometry but get an oblique depth pass driven
	// by c:view3D so they read as 3D instead of collapsing to a flat plot.
	const flat = buildFlatViewModel(element, chartData, categoryLabels, kind);
	if (is3DChartType(chartType)) {
		return withChartAreaFill(
			withUserShapeOverlay(applyChart3DDepth(flat, chartType, chartData.view3D), chartData),
			chartData,
		);
	}
	return withChartAreaFill(withUserShapeOverlay(flat, chartData), chartData);
}

/**
 * Stamp the resolved chart-area / plot-area fills onto a finished view-model so
 * every binding paints (or skips) the same background rect. A chart that
 * declares `<a:noFill/>` gets `areaFill: undefined` and no rect at all.
 */
function withChartAreaFill(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	return {
		...vm,
		areaFill: chartAreaFill(chartData),
		plotFill: plotAreaFill(chartData),
	};
}

/**
 * Append the chart's `c:userShapes` drawing overlay to a finished view-model.
 *
 * The overlay primitives are positioned in the same SVG coordinate space as the
 * chart (`svgWidth` x `svgHeight`) and layered last so they sit above the data
 * marks. Returns the view-model unchanged when the chart has no overlay.
 */
function withUserShapeOverlay(vm: ChartViewModel, chartData: PptxChartData): ChartViewModel {
	const overlay = buildChartUserShapeOverlay(chartData.userShapes, vm.svgWidth, vm.svgHeight);
	if (overlay.length === 0) {
		return vm;
	}
	return {
		...vm,
		primitives: [...vm.primitives, ...overlay],
		userShapes: overlay,
	};
}

/** Whether a chart type carries an inherent 3D depth treatment. */
function is3DChartType(chartType: string): boolean {
	return (
		chartType === 'bar3D' ||
		chartType === 'pie3D' ||
		chartType === 'line3D' ||
		chartType === 'area3D'
	);
}

/** Build the flat (2D) view-model for a resolved chart kind. */
function buildFlatViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	kind: SupportedChartKind,
): ChartViewModel {
	if (kind === 'pie' || kind === 'doughnut') {
		return buildPieViewModel(element, chartData, categoryLabels, kind === 'doughnut');
	}

	if (kind === 'radar') {
		return buildRadarViewModel(element, chartData, categoryLabels);
	}

	if (kind === 'combo') {
		return buildComboViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'stock') {
		return buildStockViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'surface') {
		return buildSurfaceViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'treemap') {
		return buildTreemapViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'waterfall') {
		return buildWaterfallViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'regionMap') {
		return buildRegionMapViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'funnel') {
		return buildFunnelViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'sunburst') {
		return buildSunburstViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'histogram') {
		return buildHistogramViewModel(element, chartData, categoryLabels);
	}
	if (kind === 'boxWhisker') {
		return buildBoxWhiskerViewModel(element, chartData, categoryLabels);
	}

	return buildCartesianViewModel(element, chartData, categoryLabels, kind);
}

export function buildFallbackViewModel(
	width: number,
	height: number,
	label: string,
): ChartViewModel {
	// Match the frame box exactly (bindings stretch with preserveAspectRatio
	// "none"; a minimum here would scale the fallback non-uniformly).
	const svgWidth = Math.max(width, 1),
		svgHeight = Math.max(height, 1);
	return {
		svgWidth,
		svgHeight,
		// No chart data to read a fill from, so the historical wash stands.
		areaFill: DEFAULT_CHART_AREA_FILL,
		title: undefined,
		titleX: svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [
			{
				kind: 'rect',
				x: 4,
				y: 4,
				w: svgWidth - 8,
				h: svgHeight - 8,
				fill: '#f1f5f9',
				rx: 4,
			} satisfies SvgRect,
		],
		dataLabels: [
			{
				kind: 'text',
				x: svgWidth / 2,
				y: svgHeight / 2,
				text: label,
				fontSize: 10,
				fill: '#94a3b8',
				textAnchor: 'middle',
				dominantBaseline: 'central',
			} satisfies SvgText,
		],
		legend: [],
		legendX: svgWidth / 2,
		legendY: svgHeight - 8,
		legendAnchor: 'middle',
	};
}

function buildPieViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	isDoughnut: boolean,
): ChartViewModel {
	const { cx, cy, outerR, innerR, size } = computePieLayout(
			element.width,
			element.height,
			chartData,
			isDoughnut,
		),
		svgWidth = Math.max(size, 100),
		svgHeight = Math.max(size, 60),
		pieSeries = chartData.series[0],
		values = pieSeries?.values ?? [],
		// c:firstSliceAng rotates the pie clockwise from 12 o'clock; c:explosion (per
		// series or per c:dPt) pulls slices outward.
		startAngle = -Math.PI / 2 + ((chartData.firstSliceAngle ?? 0) * Math.PI) / 180,
		explosions = pieSeries
			? values.map((_v, i) => resolveDataPointExplosion(pieSeries, i))
			: undefined,
		slices = computePieSlices(values, cx, cy, outerR, innerR, { startAngle, explosions }),
		primitives: SvgPrimitive[] = slices.map(
			({ d }, i) =>
				({
					kind: 'path',
					d,
					// Pie/doughnut vary colours per slice (c:varyColors defaults on), so each
					// slice takes its palette colour, with a per-point c:dPt fill overriding.
					fill: pieSeries
						? resolveVaryColorFill(pieSeries, i, paletteColor(i, chartData.colorPalette))
						: paletteColor(i, chartData.colorPalette),
					stroke: '#ffffff',
					strokeWidth: 1.5,
					part: { role: 'dataPoint', seriesIndex: 0, pointIndex: i },
					title: buildMarkTooltip(
						pieSeries?.name,
						categoryLabels[i],
						values[i] ?? 0,
						pieSeries?.numberFormat,
					),
				}) satisfies SvgPath,
		),
		dataLabels: SvgText[] = [];
	if (chartData.style?.hasDataLabels) {
		// Offset (outEnd / bestFit) labels sit outside the rim with c:leaderLines.
		// A pie's percentage base is the whole series, and `c:showPercent` is the
		// flag that makes the difference between "40" and "40%" on the commonest
		// labelled chart in a business deck.
		const percentBase = values.reduce((total, entry) => total + Math.abs(entry), 0),
			labelResult = buildPieDataLabels({
				slices,
				values,
				cx,
				cy,
				outerR,
				position: chartData.style.dataLabels?.position,
				showLeaderLines: chartData.style.dataLabels?.showLeaderLines,
				numberFormat: chartData.series[0]?.numberFormat,
				labelText: pieSeries
					? (pointIndex, value) =>
							buildDataLabelText({
								chartData,
								series: pieSeries,
								pointIndex,
								value,
								percentBase,
							})
					: undefined,
			});
		dataLabels.push(...labelResult.labels);
		primitives.push(...labelResult.leaderLines);
	}

	const legendPos = chartData.style?.legendPosition ?? 'b',
		// Legend swatches must match the slices: a per-point `c:dPt` fill overrides
		// the palette on the slice, so it overrides it on the swatch too.
		legend: LegendEntry[] = categoryLabels.map((label, i) => ({
			color: pieSeries
				? resolveVaryColorFill(pieSeries, i, paletteColor(i, chartData.colorPalette))
				: paletteColor(i, chartData.colorPalette),
			label,
		})),
		legendX = svgWidth / 2;
	let legendY = svgHeight - 8;
	const legendAnchor: 'start' | 'middle' | 'end' = 'middle';

	if (legendPos === 't') {
		legendY = chartData.style?.hasTitle ? 24 : 8;
	}

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth,
		svgHeight,
		title,
		titleX: svgWidth / 2,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

const RADAR_RINGS = 4,
	RADAR_RING_COLOR = '#cbd5e1',
	RADAR_SPOKE_COLOR = '#94a3b8',
	RADAR_LABEL_COLOR = '#64748b';

/**
 * Build the view-model for a radar / spider chart. Polar, so it has no
 * cartesian gridlines/axes; ring + spoke geometry and the data polygons all
 * live in `primitives`, perimeter category labels in `categoryLabels`.
 * Mirrors React's `renderRadarChart` (chart-radar.tsx).
 */
function buildRadarViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false),
		cx = layout.plotLeft + layout.plotWidth / 2,
		cy = layout.plotTop + layout.plotHeight / 2,
		radius = Math.max(Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4, 1),
		catCount = Math.max(categoryLabels.length, 1),
		maxVal = Math.max(1, ...chartData.series.flatMap((s) => s.values.map((v) => Math.abs(v)))),
		primitives: SvgPrimitive[] = [],
		perimeterLabels: SvgText[] = [];

	// Concentric gridline rings (dashed except the outermost).
	for (let r = 1; r <= RADAR_RINGS; r++) {
		const rr = (radius * r) / RADAR_RINGS;
		primitives.push({
			kind: 'polygon',
			points: radarRingPoints(cx, cy, rr, catCount),
			fill: 'none',
			stroke: RADAR_RING_COLOR,
			strokeWidth: 0.5,
			dashArray: r < RADAR_RINGS ? '3 2' : undefined,
		} satisfies SvgPolygon);
	}

	// Axis spokes + perimeter category labels.
	for (let i = 0; i < catCount; i++) {
		const angle = radarAngle(i, catCount);
		primitives.push({
			kind: 'line',
			x1: cx,
			y1: cy,
			x2: cx + radius * Math.cos(angle),
			y2: cy + radius * Math.sin(angle),
			stroke: RADAR_SPOKE_COLOR,
			strokeWidth: 0.5,
		} satisfies SvgLine);
		const labelR = radius + 10;
		perimeterLabels.push({
			kind: 'text',
			x: cx + labelR * Math.cos(angle),
			y: cy + labelR * Math.sin(angle),
			text: categoryLabels[i] ?? '',
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: RADAR_LABEL_COLOR,
			textAnchor: 'middle',
			dominantBaseline: 'central',
		});
	}

	// Per-series data polygons + vertex dots.
	const dataLabels: SvgText[] = [];
	chartData.series.forEach((series, si) => {
		const c = seriesColor(series, si, chartData.colorPalette),
			pts = computeRadarPoints(series.values, maxVal, radius, cx, cy, catCount);
		if (pts.length === 0) {
			return;
		}
		const pointsStr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
		primitives.push({
			kind: 'polygon',
			points: pointsStr,
			fill: c,
			opacity: 0.2,
			stroke: c,
			strokeWidth: 1.5,
			part: { role: 'series', seriesIndex: si },
			title: series.name.length > 0 ? series.name : undefined,
		} satisfies SvgPolygon);
		pts.forEach((p, vi) => {
			primitives.push({
				kind: 'circle',
				cx: p.x,
				cy: p.y,
				r: 3,
				fill: c,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
				title: buildMarkTooltip(
					series.name,
					categoryLabels[vi],
					series.values[vi] ?? 0,
					series.numberFormat,
				),
			} satisfies SvgCircle);
		});

		if (chartData.style?.hasDataLabels) {
			pts.forEach((p, vi) => {
				const val = series.values[vi];
				if (val === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: p.x,
					y: p.y - 8,
					text: formatAxisValue(val, series.numberFormat),
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	});

	const legendPos = chartData.style?.legendPosition ?? 'b',
		{ legend, legendX, legendY, legendAnchor } = buildLegend(
			chartData.series,
			chartData.colorPalette,
			layout.svgWidth,
			legendPos,
			layout.svgHeight,
			layout.plotTop,
		),
		title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: perimeterLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
