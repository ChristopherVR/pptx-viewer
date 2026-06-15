/**
 * Pure, framework-agnostic helpers for chart rendering.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-helpers.ts  (value range, Y mapping, formatting, palette)
 *   packages/react/src/viewer/utils/chart-layout.ts   (plot-area layout)
 *   packages/react/src/viewer/utils/chart-pie.tsx      (pie/doughnut geometry)
 *   packages/react/src/viewer/utils/chart-bar.tsx      (bar rect projection)
 *   packages/react/src/viewer/utils/chart-area-line.tsx (line/area point projection)
 *   packages/react/src/viewer/utils/chart-scatter-bubble.tsx (scatter point projection)
 *
 * All functions here are pure TypeScript with zero Angular dependencies.
 * The component consumes a single `ChartViewModel` that is the projection
 * of a `ChartPptxElement` -> SVG primitives.
 *
 * Supported chart kinds (viewer-first):
 *   bar / column (clustered, stacked, percentStacked) -> bar rects
 *   line / line3D -> polyline + dots
 *   area / area3D -> polygon fill + polyline
 *   pie / doughnut / pie3D / ofPie -> arc paths
 *   scatter -> circle dots
 *   bubble -> circle dots sized by a 3rd series
 *   radar / radar3D -> polar polygons + spokes
 *
 * Deferred (fallback box rendered instead):
 *   stock, waterfall, combo, surface, treemap, sunburst,
 *   funnel, boxWhisker, histogram, regionMap, bar3D (complex 3-D shading),
 *   error bars, trendlines, secondary axes, data tables.
 *
 * @module chart-renderer-helpers
 */

import type {
	ChartPptxElement,
	PptxChartData,
	PptxChartSeries,
	PptxElement,
} from 'pptx-viewer-core';

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default Office accent palette (accent1-accent6).
 * Mirrors `DEFAULT_CHART_PALETTE` from chart-helpers.ts.
 */
export const DEFAULT_PALETTE: readonly string[] = [
	'#4472C4',
	'#ED7D31',
	'#A5A5A5',
	'#FFC000',
	'#5B9BD5',
	'#70AD47',
	'#FF0000',
	'#00B0F0',
];

/** Return the palette colour for an index, preferring a parsed colour palette. */
export function paletteColor(index: number, colorPalette: readonly string[] | undefined): string {
	const pal = colorPalette && colorPalette.length > 0 ? colorPalette : DEFAULT_PALETTE;
	return pal[index % pal.length];
}

/** Resolve a series' colour, preferring the series' own `color` property. */
export function seriesColor(
	series: PptxChartSeries,
	index: number,
	colorPalette: readonly string[] | undefined,
): string {
	return series.color ?? paletteColor(index, colorPalette);
}

// ─────────────────────────────────────────────────────────────────────────────
// Value range
// ─────────────────────────────────────────────────────────────────────────────

/** Min/max/span of a value axis. */
export interface ValueRange {
	min: number;
	max: number;
	span: number;
}

/** Compute a Y-axis range that always includes zero. */
export function computeValueRange(series: ReadonlyArray<PptxChartSeries>): ValueRange {
	const all = series.flatMap((s) => s.values);
	if (all.length === 0) {
		return { min: 0, max: 1, span: 1 };
	}
	const dataMin = Math.min(...all);
	const dataMax = Math.max(...all);
	const min = Math.min(dataMin, 0);
	const max = Math.max(dataMax, 0);
	const span = Math.max(max - min, 1);
	return { min, max, span };
}

/** Compute the value range for a stacked bar (sum of positive values per category). */
export function computeStackedValueRange(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
): ValueRange {
	let maxSum = 0;
	let minSum = 0;
	for (let ci = 0; ci < catCount; ci++) {
		let pos = 0;
		let neg = 0;
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
	const min = Math.min(minSum, 0);
	const max = Math.max(maxSum, 0);
	const span = Math.max(max - min, 1);
	return { min, max, span };
}

/** Map a data value to a Y pixel coordinate (top = max, bottom = min). */
export function valueToY(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	return bottomY - ((val - range.min) / range.span) * usable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/** Format a numeric axis label to a short human-readable string. */
export function formatAxisValue(val: number): string {
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
 * Compute the plot layout for a chart element.
 * Mirrors `computeLayout` from chart-layout.ts (React), simplified to the
 * viewer-first subset (no secondary axes, no data table reservation).
 */
export function computePlotLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	hasAxes: boolean,
): PlotLayout {
	const svgWidth = Math.max(320, elementWidth);
	const svgHeight = Math.max(180, elementHeight);

	let plotLeft = hasAxes ? 48 : 8;
	let plotTop = 8;
	let plotRight = svgWidth - 8;
	let plotBottom = svgHeight - (hasAxes ? 24 : 8);

	const style = chartData.style;
	const legendPos = style?.legendPosition ?? 'b';

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

	const plotWidth = Math.max(plotRight - plotLeft, 1);
	const plotHeight = Math.max(plotBottom - plotTop, 1);

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
// SVG primitive descriptors
// ─────────────────────────────────────────────────────────────────────────────

export interface SvgRect {
	kind: 'rect';
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	rx?: number;
	opacity?: number;
}

export interface SvgPath {
	kind: 'path';
	d: string;
	fill: string;
	stroke?: string;
	strokeWidth?: number;
}

export interface SvgPolyline {
	kind: 'polyline';
	points: string;
	stroke: string;
	strokeWidth: number;
	fill: string;
	opacity?: number;
}

export interface SvgCircle {
	kind: 'circle';
	cx: number;
	cy: number;
	r: number;
	fill: string;
	opacity?: number;
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
	dominantBaseline?: string;
	opacity?: number;
}

export interface SvgPolygon {
	kind: 'polygon';
	points: string;
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity?: number;
	dashArray?: string;
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome helpers
// ─────────────────────────────────────────────────────────────────────────────

const GRIDLINE_COLOR = '#e2e8f0';
const AXIS_LABEL_COLOR = '#64748b';
const ZERO_LINE_COLOR = '#94a3b8';
const TICK_COUNT = 5;

function buildGridlinesAndLabels(
	range: ValueRange,
	layout: PlotLayout,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];

	for (let i = 0; i <= TICK_COUNT; i++) {
		const val = range.min + (range.span / TICK_COUNT) * i;
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
			fontSize: 8,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'end',
			dominantBaseline: 'central',
		});
	}

	return { gridlines, axisLabels };
}

function buildZeroLine(range: ValueRange, layout: PlotLayout): SvgLine | undefined {
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

function buildCategoryLabels(
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
			fontSize: 8,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'middle',
		} satisfies SvgText;
	});
}

function buildLegend(
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

	let legendX = svgWidth / 2;
	let legendY = svgHeight - 8;
	let legendAnchor: 'start' | 'middle' | 'end' = 'middle';

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
}

export function computeBarRects(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	colorPalette: readonly string[] | undefined,
): BarRect[] {
	const rects: BarRect[] = [];
	const seriesCount = Math.max(series.length, 1);
	const barGroupWidth = layout.plotWidth / Math.max(catCount, 1);
	const singleBarWidth = (barGroupWidth * 0.7) / seriesCount;
	const groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

	for (let ci = 0; ci < catCount; ci++) {
		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[ci] ?? 0;
			const x = layout.plotLeft + barGroupWidth * ci + groupOffset + singleBarWidth * si;
			const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
			const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
			const y = Math.min(zeroY, valY);
			const h = Math.max(Math.abs(zeroY - valY), 1);
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
	const rects: BarRect[] = [];
	const barW = (layout.plotWidth / Math.max(catCount, 1)) * 0.7;
	const barOffset = (layout.plotWidth / Math.max(catCount, 1) - barW) / 2;
	const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);

	for (let ci = 0; ci < catCount; ci++) {
		let posTop = zeroY;
		let negBottom = zeroY;

		for (let si = 0; si < series.length; si++) {
			const val = series[si].values[ci] ?? 0;
			if (val === 0) {
				continue;
			}
			const x = layout.plotLeft + (layout.plotWidth / Math.max(catCount, 1)) * ci + barOffset;
			const h = Math.max(
				Math.abs(
					valueToY(val, range, layout.plotTop, layout.plotBottom) -
						valueToY(0, range, layout.plotTop, layout.plotBottom),
				),
				1,
			);
			if (val > 0) {
				const y = posTop - h;
				rects.push({ x, y, w: barW, h, fill: seriesColor(series[si], si, colorPalette) });
				posTop = y;
			} else {
				const y = negBottom;
				rects.push({ x, y, w: barW, h, fill: seriesColor(series[si], si, colorPalette) });
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
		const nx = n > 1 ? i / (n - 1) : 0;
		const x = layout.plotLeft + layout.plotWidth * nx;
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
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
	const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
	const x1 = cx + outerR * Math.cos(startAngle);
	const y1 = cy + outerR * Math.sin(startAngle);
	const x2 = cx + outerR * Math.cos(endAngle);
	const y2 = cy + outerR * Math.sin(endAngle);

	let d: string;
	if (innerR > 0) {
		const ix1 = cx + innerR * Math.cos(startAngle);
		const iy1 = cy + innerR * Math.sin(startAngle);
		const ix2 = cx + innerR * Math.cos(endAngle);
		const iy2 = cy + innerR * Math.sin(endAngle);
		d = `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`;
	} else {
		d = `M${cx},${cy} L${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} Z`;
	}

	const midAngle = (startAngle + endAngle) / 2;
	const labelR = outerR * 0.7;
	const labelX = cx + labelR * Math.cos(midAngle);
	const labelY = cy + labelR * Math.sin(midAngle);

	return { d, midAngle, labelX, labelY };
}

export function computePieLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	isDoughnut: boolean,
): { cx: number; cy: number; outerR: number; innerR: number; size: number } {
	const size = Math.min(Math.max(elementWidth, 1), Math.max(elementHeight, 1));
	const titleOffset = chartData.style?.hasTitle ? 20 : 0;
	const legendOffset = chartData.style?.hasLegend ? 20 : 0;
	const cx = size / 2;
	const cy = titleOffset + (size - titleOffset - legendOffset) / 2;
	const outerR = Math.max((size - titleOffset - legendOffset) * 0.42, 0);
	const innerR = isDoughnut ? outerR * 0.55 : 0;
	return { cx, cy, outerR, innerR, size };
}

export function computePieSlices(
	values: ReadonlyArray<number>,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
): PieSliceGeometry[] {
	const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
	let cumAngle = -Math.PI / 2;
	return values.map((val) => {
		const sliceAngle = (Math.abs(val) / total) * Math.PI * 2;
		const startAngle = cumAngle;
		cumAngle += sliceAngle;
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

export function computeScatterDots(
	values: ReadonlyArray<number>,
	maxXIndex: number,
	layout: PlotLayout,
	range: ValueRange,
): ScatterDot[] {
	return values.map((val, i) => ({
		cx: layout.plotLeft + (maxXIndex > 0 ? i / maxXIndex : 0) * layout.plotWidth,
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
		const angle = radarAngle(i, catCount);
		const r = (Math.abs(val) / denom) * radius;
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
	| 'radar';

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
	const chartEl = element as ChartPptxElement;
	const chartData = chartEl.chartData;

	if (!chartData || chartData.series.length === 0) {
		return buildFallbackViewModel(element.width, element.height, chartData?.title ?? 'Chart');
	}

	const chartType = chartData.chartType ?? 'bar';
	const kind = resolveChartKind(chartType);

	if (kind === 'unsupported') {
		return buildFallbackViewModel(element.width, element.height, chartData.title ?? chartType);
	}

	const longestLen = chartData.series.reduce((m, s) => Math.max(m, s.values.length), 0);
	const categoryLabels =
		chartData.categories.length > 0
			? chartData.categories
			: Array.from({ length: longestLen }, (_, i) => String(i + 1));

	if (kind === 'pie' || kind === 'doughnut') {
		return buildPieViewModel(element, chartData, categoryLabels, kind === 'doughnut');
	}

	if (kind === 'radar') {
		return buildRadarViewModel(element, chartData, categoryLabels);
	}

	return buildCartesianViewModel(element, chartData, categoryLabels, kind);
}

export function buildFallbackViewModel(
	width: number,
	height: number,
	label: string,
): ChartViewModel {
	const svgWidth = Math.max(width, 100);
	const svgHeight = Math.max(height, 60);
	return {
		svgWidth,
		svgHeight,
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
	);
	const svgWidth = Math.max(size, 100);
	const svgHeight = Math.max(size, 60);

	const values = chartData.series[0]?.values ?? [];
	const slices = computePieSlices(values, cx, cy, outerR, innerR);
	const primitives: SvgPrimitive[] = slices.map(
		({ d }, i) =>
			({
				kind: 'path',
				d,
				fill: chartData.series[0]?.color ?? paletteColor(i, chartData.colorPalette),
				stroke: '#ffffff',
				strokeWidth: 1.5,
			}) satisfies SvgPath,
	);

	const dataLabels: SvgText[] = [];
	if (chartData.style?.hasDataLabels) {
		slices.forEach(({ labelX, labelY }, i) => {
			const val = values[i];
			if (val === undefined) {
				return;
			}
			dataLabels.push({
				kind: 'text',
				x: labelX,
				y: labelY,
				text: formatAxisValue(val),
				fontSize: 8,
				fill: '#ffffff',
				textAnchor: 'middle',
				fontWeight: 'bold',
				dominantBaseline: 'central',
			});
		});
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const legend: LegendEntry[] = categoryLabels.map((label, i) => ({
		color: paletteColor(i, chartData.colorPalette),
		label,
	}));

	const legendX = svgWidth / 2;
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

function buildCartesianViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	kind: SupportedChartKind,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const catCount = Math.max(categoryLabels.length, 1);

	const isStacked =
		kind === 'bar' && (chartData.grouping === 'stacked' || chartData.grouping === 'percentStacked');
	const range = isStacked
		? computeStackedValueRange(chartData.series, catCount)
		: computeValueRange(chartData.series);

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
	const catAxisStyle =
		kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'bubble' ? 'line' : 'bar';
	const catLabels = buildCategoryLabels(categoryLabels, layout, catAxisStyle);

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	if (kind === 'bar') {
		const rects = isStacked
			? computeStackedBarRects(chartData.series, catCount, layout, range, chartData.colorPalette)
			: computeBarRects(chartData.series, catCount, layout, range, chartData.colorPalette);

		for (const r of rects) {
			primitives.push({
				kind: 'rect',
				x: r.x,
				y: r.y,
				w: r.w,
				h: r.h,
				fill: r.fill,
				rx: 1,
			} satisfies SvgRect);
		}

		if (chartData.style?.hasDataLabels) {
			const barGroupWidth = layout.plotWidth / catCount;
			const seriesCount = Math.max(chartData.series.length, 1);
			const singleBarWidth = (barGroupWidth * 0.7) / seriesCount;
			const groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

			for (let ci = 0; ci < catCount; ci++) {
				for (let si = 0; si < chartData.series.length; si++) {
					const val = chartData.series[si].values[ci] ?? 0;
					const x =
						layout.plotLeft +
						barGroupWidth * ci +
						groupOffset +
						singleBarWidth * si +
						singleBarWidth / 2;
					const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
					const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
					const labelY = val >= 0 ? Math.min(zeroY, valY) - 4 : Math.max(zeroY, valY) + 10;
					dataLabels.push({
						kind: 'text',
						x,
						y: labelY,
						text: formatAxisValue(val),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				}
			}
		}
	} else if (kind === 'line') {
		for (let si = 0; si < chartData.series.length; si++) {
			const series = chartData.series[si];
			if (series.values.length === 0) {
				continue;
			}
			const pts = computeLinePoints(series.values, catCount, layout, range);
			const c = seriesColor(series, si, chartData.colorPalette);
			const pointsStr = linePointsToSvgString(pts);

			primitives.push({
				kind: 'polyline',
				points: pointsStr,
				stroke: c,
				strokeWidth: 2.4,
				fill: 'none',
			} satisfies SvgPolyline);
			for (const pt of pts) {
				primitives.push({
					kind: 'circle',
					cx: pt.x,
					cy: pt.y,
					r: 2.5,
					fill: c,
				} satisfies SvgCircle);
			}

			if (chartData.style?.hasDataLabels) {
				series.values.forEach((val, vi) => {
					const pt = pts[vi];
					if (!pt) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: pt.x,
						y: pt.y - 7,
						text: formatAxisValue(val),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				});
			}
		}
	} else if (kind === 'area') {
		const baselineY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		for (let si = 0; si < chartData.series.length; si++) {
			const series = chartData.series[si];
			if (series.values.length === 0) {
				continue;
			}
			const pts = computeLinePoints(series.values, catCount, layout, range);
			const c = seriesColor(series, si, chartData.colorPalette);
			const lineStr = linePointsToSvgString(pts);
			const firstPt = pts[0];
			const lastPt = pts[pts.length - 1];

			if (firstPt && lastPt) {
				primitives.push({
					kind: 'polyline',
					points: `${layout.plotLeft.toFixed(2)},${baselineY.toFixed(2)} ${lineStr} ${lastPt.x.toFixed(2)},${baselineY.toFixed(2)}`,
					stroke: 'none',
					strokeWidth: 0,
					fill: c,
					opacity: 0.25,
				} satisfies SvgPolyline);
			}
			primitives.push({
				kind: 'polyline',
				points: lineStr,
				stroke: c,
				strokeWidth: 2,
				fill: 'none',
			} satisfies SvgPolyline);

			if (chartData.style?.hasDataLabels) {
				series.values.forEach((val, vi) => {
					const pt = pts[vi];
					if (!pt) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: pt.x,
						y: pt.y - 6,
						text: formatAxisValue(val),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				});
			}
		}
	} else if (kind === 'scatter') {
		const allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i));
		const maxXIndex = Math.max(1, ...allIndices);

		for (let si = 0; si < chartData.series.length; si++) {
			const series = chartData.series[si];
			const c = seriesColor(series, si, chartData.colorPalette);
			const dots = computeScatterDots(series.values, maxXIndex, layout, range);
			for (const dot of dots) {
				primitives.push({
					kind: 'circle',
					cx: dot.cx,
					cy: dot.cy,
					r: 4,
					fill: c,
					opacity: 0.85,
				} satisfies SvgCircle);
			}

			if (chartData.style?.hasDataLabels) {
				series.values.forEach((val, vi) => {
					const dot = dots[vi];
					if (!dot) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: dot.cx,
						y: dot.cy - 6,
						text: formatAxisValue(val),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				});
			}
		}
	} else if (kind === 'bubble') {
		// X = category index, Y = first/second series value, size = third series.
		const allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i));
		const maxXIndex = Math.max(1, ...allIndices);
		const sizeSeries = chartData.series.length >= 3 ? chartData.series[2] : undefined;
		const maxBubble = sizeSeries ? Math.max(1, ...sizeSeries.values.map((v) => Math.abs(v))) : 1;
		const medianRadius = Math.min(layout.plotWidth, layout.plotHeight) * 0.04;
		const pointSeries = chartData.series.slice(0, 2);

		for (let si = 0; si < pointSeries.length; si++) {
			const series = pointSeries[si];
			const c = seriesColor(series, si, chartData.colorPalette);
			const dots = computeScatterDots(series.values, maxXIndex, layout, range);
			dots.forEach((dot, vi) => {
				const r = computeBubbleRadius(sizeSeries?.values[vi], maxBubble, medianRadius);
				primitives.push({
					kind: 'circle',
					cx: dot.cx,
					cy: dot.cy,
					r,
					fill: c,
					opacity: 0.6,
				} satisfies SvgCircle);
			});

			if (chartData.style?.hasDataLabels) {
				series.values.forEach((val, vi) => {
					const dot = dots[vi];
					if (!dot) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: dot.cx,
						y: dot.cy - 10,
						text: formatAxisValue(val),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				});
			}
		}
	}

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

const RADAR_RINGS = 4;
const RADAR_RING_COLOR = '#cbd5e1';
const RADAR_SPOKE_COLOR = '#94a3b8';
const RADAR_LABEL_COLOR = '#64748b';

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
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const cx = layout.plotLeft + layout.plotWidth / 2;
	const cy = layout.plotTop + layout.plotHeight / 2;
	const radius = Math.max(Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4, 1);
	const catCount = Math.max(categoryLabels.length, 1);
	const maxVal = Math.max(1, ...chartData.series.flatMap((s) => s.values.map((v) => Math.abs(v))));

	const primitives: SvgPrimitive[] = [];
	const perimeterLabels: SvgText[] = [];

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
			fontSize: 8,
			fill: RADAR_LABEL_COLOR,
			textAnchor: 'middle',
			dominantBaseline: 'central',
		});
	}

	// Per-series data polygons + vertex dots.
	const dataLabels: SvgText[] = [];
	chartData.series.forEach((series, si) => {
		const c = seriesColor(series, si, chartData.colorPalette);
		const pts = computeRadarPoints(series.values, maxVal, radius, cx, cy, catCount);
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
		} satisfies SvgPolygon);
		for (const p of pts) {
			primitives.push({ kind: 'circle', cx: p.x, cy: p.y, r: 3, fill: c } satisfies SvgCircle);
		}

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
					text: formatAxisValue(val),
					fontSize: 7,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	});

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

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
