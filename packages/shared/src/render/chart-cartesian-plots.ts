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
import type { PptxChartData } from 'pptx-viewer-core';

import type {
	PlotLayout,
	SvgCircle,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	computeBubbleRadius,
	computeLinePoints,
	computeScatterDots,
	formatAxisValue,
	linePointsToSvgString,
	seriesColor,
	valueToY,
} from './chart-view-model';

/** Aggregate result of a per-kind plot builder: primitives + data labels. */
export interface SeriesPlotResult {
	primitives: SvgPrimitive[];
	dataLabels: SvgText[];
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
		const displayValues = sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0);
		const pts = computeLinePoints(displayValues, catCount, layout, activeRange).map(
			(point, index) => ({
				...point,
				x: xPositions?.[index] ?? point.x,
			}),
		);
		const c = seriesColor(series, si, chartData.colorPalette);
		primitives.push({
			kind: 'polyline',
			points: linePointsToSvgString(pts),
			stroke: c,
			strokeWidth: 2.4,
			fill: 'none',
			part: { role: 'series', seriesIndex: si },
		} satisfies SvgPolyline);
		pts.forEach((pt, displayIndex) => {
			const sourceIndex = sourceIndices[displayIndex] ?? displayIndex;
			primitives.push({
				kind: 'circle',
				cx: pt.x,
				cy: pt.y,
				r: 2.5,
				fill: c,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: sourceIndex },
			} satisfies SvgCircle);
		});
		if (showLabels) {
			displayValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
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
			primitives.push({
				kind: 'circle',
				cx: pt.x,
				cy: pt.y,
				r: 2,
				fill: c,
				part: {
					role: 'dataPoint',
					seriesIndex: si,
					pointIndex: sourceIndices[displayIndex] ?? displayIndex,
				},
			} satisfies SvgCircle);
		});
		if (showLabels) {
			displayValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
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
	return { primitives, dataLabels };
}

/** Build scatter-chart primitives. */
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
	const xValues = chartData.categories.map(Number);

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si];
		const c = seriesColor(series, si, chartData.colorPalette);
		const dots = computeScatterDots(series.values, maxXIndex, layout, range, xValues);
		dots.forEach((dot, vi) => {
			primitives.push({
				kind: 'circle',
				cx: dot.cx,
				cy: dot.cy,
				r: 4,
				fill: c,
				opacity: 0.85,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
			} satisfies SvgCircle);
		});
		if (showLabels) {
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
	return { primitives, dataLabels };
}

/** Build bubble-chart primitives (first two series as points, third as size). */
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
	const xValues = chartData.categories.map(Number);
	const sizeSeries = chartData.series.length >= 3 ? chartData.series[2] : undefined;
	const maxBubble = sizeSeries ? Math.max(1, ...sizeSeries.values.map((v) => Math.abs(v))) : 1;
	const medianRadius = Math.min(layout.plotWidth, layout.plotHeight) * 0.04;
	const pointSeries = chartData.series.slice(0, 2);

	for (let si = 0; si < pointSeries.length; si++) {
		const series = pointSeries[si];
		const c = seriesColor(series, si, chartData.colorPalette);
		const dots = computeScatterDots(series.values, maxXIndex, layout, range, xValues);
		dots.forEach((dot, vi) => {
			const r = computeBubbleRadius(sizeSeries?.values[vi], maxBubble, medianRadius);
			primitives.push({
				kind: 'circle',
				cx: dot.cx,
				cy: dot.cy,
				r,
				fill: c,
				opacity: 0.6,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
			} satisfies SvgCircle);
		});
		if (showLabels) {
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
	return { primitives, dataLabels };
}
