/**
 * chart-cartesian-plots.ts: per-kind plot-primitive builders for the enriched
 * cartesian chart engine (bar / line / area / scatter / bubble).
 *
 * Split out of `chart-cartesian.ts` to keep each module within the repo's
 * ~300-LOC limit. These are pure helpers consumed by `buildCartesianViewModel`;
 * they reuse the geometry primitives in `chart-view-model.ts` and honour the
 * secondary value range (clustered bar / line) and percentStacked normalisation.
 *
 * @module chart-cartesian-plots
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveBlankDisplay, visibleRuns } from './chart-blank-display';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointFill, resolveDataPointMarker } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { smoothLinePath } from './chart-line-path';
import { buildMarkerPrimitive } from './chart-marker-shape';
import type {
	ChartPartRef,
	PlotLayout,
	SvgCircle,
	SvgPath,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	computeBubbleRadius,
	computeLinePoints,
	computeScatterDots,
	computeScatterXDomain,
	linePointsToSvgString,
	seriesColor,
	valueToY,
} from './chart-view-model';

/** Aggregate result of a per-kind plot builder: primitives + data labels. */
export interface SeriesPlotResult {
	primitives: SvgPrimitive[];
	dataLabels: SvgText[];
}

/**
 * Build the marker for a data point (honouring `marker.symbol`/`size`) and push
 * it, unless the symbol is `none`. Shared by the line / area / scatter builders.
 *
 * `pointIndex` is the SOURCE index (the `c:idx` a `c:dPt` is keyed by), not the
 * display position, because a chart with hidden/filtered categories renders
 * fewer points than the series declares and the override must still land on the
 * point the author picked.
 */
function pushMarker(
	out: SvgPrimitive[],
	series: PptxChartSeries,
	pointIndex: number,
	cx: number,
	cy: number,
	fill: string,
	defaultRadius: number,
	part: ChartPartRef,
	opacity?: number,
): void {
	const marker = resolveDataPointMarker(series, pointIndex);
	const m = buildMarkerPrimitive({
		symbol: marker.symbol,
		size: marker.size,
		cx,
		cy,
		// A marker fill (series or per-point) wins over the plot fill, which is
		// what the line/area body is drawn with.
		fill: marker.fill ?? fill,
		defaultRadius,
		part,
	});
	if (!m) {
		return;
	}
	if (opacity !== undefined) {
		m.opacity = opacity;
	}
	out.push(m);
}

/** Build line-chart primitives, honouring a secondary value range per series. */
export function buildLines(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIdx: ReadonlySet<number>,
	sourceIndices: ReadonlyArray<number>,
	xPositions?: ReadonlyArray<number>,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];
	const showLabels = chartData.style?.hasDataLabels;

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si];
		if (series.values.length === 0) {
			continue;
		}
		const activeRange = secondaryIdx.has(si) && secondaryRange ? secondaryRange : primaryRange;
		const rawValues = sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0);
		const displayBlanks = sourceIndices.map((sourceIndex) => series.blanks?.[sourceIndex] ?? false);
		// Honour c:dispBlanksAs: gap breaks the line at blanks, span interpolates,
		// zero/unset keep the placeholder 0 (existing behaviour).
		const { values: displayValues, visible } = resolveBlankDisplay(
			rawValues,
			displayBlanks,
			chartData.chartChrome?.dispBlanksAs,
		);
		const pts = computeLinePoints(displayValues, catCount, layout, activeRange).map(
			(point, index) => ({
				...point,
				x: xPositions?.[index] ?? point.x,
			}),
		);
		const c = seriesColor(series, si, chartData.colorPalette);
		// c:smooth draws a bezier path through the points; otherwise a polyline.
		const seriesPart: ChartPartRef = { role: 'series', seriesIndex: si };
		const allVisible = visible.every(Boolean);
		if (allVisible) {
			primitives.push(
				series.smooth
					? ({
							kind: 'path',
							d: smoothLinePath(pts),
							stroke: c,
							strokeWidth: 2.4,
							fill: 'none',
							part: seriesPart,
						} satisfies SvgPath)
					: ({
							kind: 'polyline',
							points: linePointsToSvgString(pts),
							stroke: c,
							strokeWidth: 2.4,
							fill: 'none',
							part: seriesPart,
						} satisfies SvgPolyline),
			);
		} else {
			// gap mode: draw one polyline per contiguous run of visible points.
			for (const run of visibleRuns(visible)) {
				if (run.length < 2) {
					continue;
				}
				primitives.push({
					kind: 'polyline',
					points: linePointsToSvgString(run.map((i) => pts[i])),
					stroke: c,
					strokeWidth: 2.4,
					fill: 'none',
					part: seriesPart,
				} satisfies SvgPolyline);
			}
		}
		pts.forEach((pt, displayIndex) => {
			if (!visible[displayIndex]) {
				return;
			}
			const idx = sourceIndices[displayIndex] ?? displayIndex;
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: si, pointIndex: idx };
			pushMarker(
				primitives,
				series,
				idx,
				pt.x,
				pt.y,
				resolveDataPointFill(series, idx, c) ?? c,
				2.5,
				part,
			);
		});
		if (showLabels) {
			displayValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
				const text = buildDataLabelText({
					chartData,
					series,
					pointIndex: sourceIndices[displayIndex] ?? displayIndex,
					value: val,
				});
				if (!pt || !visible[displayIndex] || text === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: pt.x,
					y: pt.y - 7,
					text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	}
	return { primitives, dataLabels };
}

/** Build area-chart primitives (fill polygon + outline). */
export function buildAreas(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	sourceIndices: ReadonlyArray<number>,
	xPositions?: ReadonlyArray<number>,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];
	const showLabels = chartData.style?.hasDataLabels;
	const baselineY = valueToY(0, range, layout.plotTop, layout.plotBottom);

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si];
		if (series.values.length === 0) {
			continue;
		}
		const displayValues = sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0);
		const pts = computeLinePoints(displayValues, catCount, layout, range).map((point, index) => ({
			...point,
			x: xPositions?.[index] ?? point.x,
		}));
		const c = seriesColor(series, si, chartData.colorPalette);
		const lineStr = linePointsToSvgString(pts);
		const firstPt = pts[0];
		const lastPt = pts[pts.length - 1];
		if (firstPt && lastPt) {
			primitives.push({
				kind: 'polyline',
				points: `${firstPt.x.toFixed(2)},${baselineY.toFixed(2)} ${lineStr} ${lastPt.x.toFixed(2)},${baselineY.toFixed(2)}`,
				stroke: 'none',
				strokeWidth: 0,
				fill: c,
				opacity: 0.25,
				part: { role: 'series', seriesIndex: si },
			} satisfies SvgPolyline);
		}
		primitives.push({
			kind: 'polyline',
			points: lineStr,
			stroke: c,
			strokeWidth: 2,
			fill: 'none',
			part: { role: 'series', seriesIndex: si },
		} satisfies SvgPolyline);
		pts.forEach((pt, displayIndex) => {
			const idx = sourceIndices[displayIndex] ?? displayIndex;
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: si, pointIndex: idx };
			pushMarker(
				primitives,
				series,
				idx,
				pt.x,
				pt.y,
				resolveDataPointFill(series, idx, c) ?? c,
				2,
				part,
			);
		});
		if (showLabels) {
			displayValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
				const text = buildDataLabelText({
					chartData,
					series,
					pointIndex: sourceIndices[displayIndex] ?? displayIndex,
					value: val,
				});
				if (!pt || text === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: pt.x,
					y: pt.y - 6,
					text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	}
	return { primitives, dataLabels };
}

/**
 * X values a scatter / bubble series is plotted against.
 *
 * The series' own `c:xVal` wins. Only when it has none does the chart-level
 * category list stand in, which is all the engine used to have and is why every
 * series in a multi-series scatter was plotted against series 1's x axis.
 */
function seriesXValues(
	chartData: PptxChartData,
	series: PptxChartSeries,
): ReadonlyArray<number> | undefined {
	if (series.xValues && series.xValues.length > 0) {
		return series.xValues;
	}
	const fromCategories = chartData.categories.map(Number);
	return fromCategories.length > 0 ? fromCategories : undefined;
}

/**
 * Whether `c:scatterStyle` joins the points with a line.
 *
 * `lineMarker` is what PowerPoint writes for essentially every scatter chart,
 * including the marker-only ones: it expresses "no line" as an `a:ln/a:noFill`
 * on the series, not by switching the style to `marker`. Both have to be
 * checked, and the series flag has to win, or a "Scatter with Straight Lines"
 * deck loses its lines and a marker-only deck grows some.
 */
function scatterDrawsLine(chartData: PptxChartData, series: PptxChartSeries): boolean {
	if (series.lineNoFill === true) {
		return false;
	}
	const style = chartData.scatterStyle;
	return (
		style === 'line' || style === 'lineMarker' || style === 'smooth' || style === 'smoothMarker'
	);
}

/** Build scatter-chart primitives, honouring `c:scatterStyle` connecting lines. */
export function buildScatter(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];
	const showLabels = chartData.style?.hasDataLabels;
	const allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i));
	const maxXIndex = Math.max(1, ...allIndices);
	const perSeriesX = chartData.series.map((series) => seriesXValues(chartData, series));
	const xDomain = computeScatterXDomain(perSeriesX);
	const smoothStyle =
		chartData.scatterStyle === 'smooth' || chartData.scatterStyle === 'smoothMarker';

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si];
		const c = seriesColor(series, si, chartData.colorPalette);
		const dots = computeScatterDots(
			series.values,
			maxXIndex,
			layout,
			range,
			perSeriesX[si],
			xDomain,
		);
		// The connecting line goes down FIRST so the markers sit on top of it.
		if (scatterDrawsLine(chartData, series) && dots.length >= 2) {
			const points = dots.map((dot) => ({ x: dot.cx, y: dot.cy }));
			const seriesPart: ChartPartRef = { role: 'series', seriesIndex: si };
			primitives.push(
				(series.smooth ?? smoothStyle)
					? ({
							kind: 'path',
							d: smoothLinePath(points),
							stroke: c,
							strokeWidth: 2.4,
							fill: 'none',
							part: seriesPart,
						} satisfies SvgPath)
					: ({
							kind: 'polyline',
							points: linePointsToSvgString(points),
							stroke: c,
							strokeWidth: 2.4,
							fill: 'none',
							part: seriesPart,
						} satisfies SvgPolyline),
			);
		}
		dots.forEach((dot, vi) => {
			const part: ChartPartRef = { role: 'dataPoint', seriesIndex: si, pointIndex: vi };
			pushMarker(
				primitives,
				series,
				vi,
				dot.cx,
				dot.cy,
				resolveDataPointFill(series, vi, c) ?? c,
				4,
				part,
				0.85,
			);
		});
		if (showLabels) {
			series.values.forEach((val, vi) => {
				const dot = dots[vi];
				const text = buildDataLabelText({ chartData, series, pointIndex: vi, value: val });
				if (!dot || text === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: dot.cx,
					y: dot.cy - 6,
					text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	}
	return { primitives, dataLabels };
}

/**
 * Build bubble-chart primitives.
 *
 * Every series carries its own `c:xVal`, `c:yVal` AND `c:bubbleSize`, so each
 * one is a complete bubble series. The engine used to read sizes off "the third
 * series", which drew equal-sized dots for the ordinary one-series bubble chart
 * and silently deleted every series past the second from a three-series one.
 */
export function buildBubbles(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];
	const showLabels = chartData.style?.hasDataLabels;
	const allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i));
	const maxXIndex = Math.max(1, ...allIndices);
	const perSeriesX = chartData.series.map((series) => seriesXValues(chartData, series));
	const xDomain = computeScatterXDomain(perSeriesX);
	// One size scale for the whole chart, so bubbles stay comparable across series.
	const allSizes = chartData.series.flatMap((series) => series.bubbleSizes ?? []);
	const maxBubble = allSizes.length > 0 ? Math.max(1, ...allSizes.map(Math.abs)) : 1;
	const medianRadius = Math.min(layout.plotWidth, layout.plotHeight) * 0.04;

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si];
		const c = seriesColor(series, si, chartData.colorPalette);
		const dots = computeScatterDots(
			series.values,
			maxXIndex,
			layout,
			range,
			perSeriesX[si],
			xDomain,
		);
		dots.forEach((dot, vi) => {
			const r = computeBubbleRadius(series.bubbleSizes?.[vi], maxBubble, medianRadius);
			primitives.push({
				kind: 'circle',
				cx: dot.cx,
				cy: dot.cy,
				r,
				fill: resolveDataPointFill(series, vi, c) ?? c,
				opacity: 0.6,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
			} satisfies SvgCircle);
		});
		if (showLabels) {
			series.values.forEach((val, vi) => {
				const dot = dots[vi];
				const text = buildDataLabelText({ chartData, series, pointIndex: vi, value: val });
				if (!dot || text === undefined) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: dot.cx,
					y: dot.cy - 10,
					text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				});
			});
		}
	}
	return { primitives, dataLabels };
}
