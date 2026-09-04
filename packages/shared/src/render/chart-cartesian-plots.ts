/**
 * chart-cartesian-plots.ts: per-kind plot-primitive builders for the enriched
 * cartesian chart engine (scatter / bubble). Line and area live in
 * `chart-cartesian-line-area.ts`, bar in `chart-cartesian-bars.ts`.
 *
 * Split out of `chart-cartesian.ts` to keep each module within the repo's
 * ~300-LOC limit. These are pure helpers consumed by `buildCartesianViewModel`;
 * they reuse the geometry primitives in `chart-view-model.ts`.
 *
 * @module chart-cartesian-plots
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveMarkerLabelPlacement } from './chart-data-label-anchor';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointFill, resolveDataPointMarker } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { smoothLinePath } from './chart-line-path';
import { buildMarkerPrimitive } from './chart-marker-shape';
import type {
	ChartPartRef,
	PlotLayout,
	SvgPath,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	computeScatterDots,
	computeScatterXDomain,
	formatAxisValue,
	linePointsToSvgString,
	seriesColor,
} from './chart-view-model';

/**
 * Chart-element pixel box a manual `c:dLbl/c:layout` drag is measured
 * against. Exported for `chart-cartesian-bubbles.ts`, which shares this
 * module's XY plumbing.
 */
export function elementFrame(layout: PlotLayout): { width: number; height: number } {
	return { width: layout.svgWidth, height: layout.svgHeight };
}

/** Aggregate result of a per-kind plot builder: primitives + data labels. */
export interface SeriesPlotResult {
	primitives: SvgPrimitive[];
	dataLabels: SvgText[];
}

/**
 * Hover-tooltip text for an XY (scatter/bubble) point: `"<series>: (x, y)"`.
 * Neither kind has a category label to hang the tooltip off, unlike
 * `buildMarkTooltip`'s bar/line/area/pie/radar marks, so this formats the raw
 * coordinate pair instead. Exported for `chart-cartesian-bubbles.ts`.
 */
export function xyMarkTooltip(
	seriesName: string,
	xVal: number | undefined,
	yVal: number,
	numberFormat: string | undefined,
): string {
	const y = formatAxisValue(yVal, numberFormat),
		coords = xVal !== undefined ? `(${formatAxisValue(xVal)}, ${y})` : y;
	return seriesName.length > 0 ? `${seriesName}: ${coords}` : coords;
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
export function pushMarker(
	out: SvgPrimitive[],
	series: PptxChartSeries,
	pointIndex: number,
	cx: number,
	cy: number,
	fill: string,
	defaultRadius: number,
	part: ChartPartRef,
	opacity?: number,
	title?: string,
): void {
	const marker = resolveDataPointMarker(series, pointIndex),
		m = buildMarkerPrimitive({
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
	if (title !== undefined) {
		m.title = title;
	}
	out.push(m);
}

/**
 * X values a scatter / bubble series is plotted against.
 *
 * The series' own `c:xVal` wins. Only when it has none does the chart-level
 * category list stand in, which is all the engine used to have and is why every
 * series in a multi-series scatter was plotted against series 1's x axis.
 * Exported for `chart-cartesian-bubbles.ts`.
 */
export function seriesXValues(
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
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		showLabels = chartData.style?.hasDataLabels,
		allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i)),
		maxXIndex = Math.max(1, ...allIndices),
		perSeriesX = chartData.series.map((series) => seriesXValues(chartData, series)),
		xDomain = computeScatterXDomain(perSeriesX),
		smoothStyle = chartData.scatterStyle === 'smooth' || chartData.scatterStyle === 'smoothMarker';

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si],
			c = seriesColor(series, si, chartData.colorPalette),
			dots = computeScatterDots(series.values, maxXIndex, layout, range, perSeriesX[si], xDomain);
		// The connecting line goes down FIRST so the markers sit on top of it.
		if (scatterDrawsLine(chartData, series) && dots.length >= 2) {
			const points = dots.map((dot) => ({ x: dot.cx, y: dot.cy })),
				seriesPart: ChartPartRef = { role: 'series', seriesIndex: si };
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
				xyMarkTooltip(
					series.name,
					perSeriesX[si]?.[vi],
					series.values[vi] ?? 0,
					series.numberFormat,
				),
			);
		});
		if (showLabels) {
			series.values.forEach((val, vi) => {
				const dot = dots[vi],
					label = buildDataLabelText({ chartData, series, pointIndex: vi, value: val });
				if (!dot || label === undefined) {
					return;
				}
				// c:dLblPos (t/b/l/r/ctr) decides where round the marker the label
				// sits; a per-point c:dLbl/c:layout drag shifts it further.
				const anchor = resolveMarkerLabelPlacement(
					chartData,
					series,
					vi,
					{ x: dot.cx, y: dot.cy },
					elementFrame(layout),
					6,
				);
				dataLabels.push({
					kind: 'text',
					x: anchor.x,
					y: anchor.y,
					text: label.text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: label.color ?? '#334155',
					textAnchor: anchor.textAnchor,
					...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
				});
			});
		}
	}
	return { primitives, dataLabels };
}
