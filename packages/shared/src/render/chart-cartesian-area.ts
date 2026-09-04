/**
 * chart-cartesian-area.ts: area-chart plot-primitive builder, split out of
 * `chart-cartesian-line-area.ts` (which still owns `buildLines`) to keep each
 * module within the repo's ~300-LOC limit.
 *
 * @module chart-cartesian-area
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { pushMarker } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { resolveMarkerLabelPlacement } from './chart-data-label-anchor';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { computeStackedSeriesPlots } from './chart-stacked-series';
import type { LineAreaStacking } from './chart-stacked-series';
import type {
	ChartPartRef,
	PlotLayout,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildMarkTooltip,
	computeLinePoints,
	linePointsToSvgString,
	seriesColor,
	valueToY,
} from './chart-view-model';

/**
 * Build area-chart primitives (fill polygon + outline).
 *
 * Stacked/percentStacked fills the band between this series' running-sum top
 * and the previous series' top (its own base) instead of down to the zero
 * baseline, so layers stack visually like a PowerPoint stacked area chart
 * rather than each series washing over the ones below it. Data labels and
 * marker tooltips read the series' own value (or percent share), matching
 * `buildLines` and stacked bar's label convention.
 */
export function buildAreas(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	sourceIndices: ReadonlyArray<number>,
	xPositions?: ReadonlyArray<number>,
	stacking: LineAreaStacking = 'clustered',
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		showLabels = chartData.style?.hasDataLabels,
		isStackedMode = stacking !== 'clustered',
		isPercent = stacking === 'percentStacked',
		baselineY = valueToY(0, range, layout.plotTop, layout.plotBottom),
		allDisplayValues = chartData.series.map((series) =>
			series.values.length === 0
				? undefined
				: sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0),
		),
		stackedPlots = isStackedMode
			? computeStackedSeriesPlots(
					allDisplayValues.map((values) => values ?? []),
					catCount,
					isPercent,
				)
			: undefined;

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si],
			displayValues = allDisplayValues[si];
		if (!displayValues) {
			continue;
		}
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const plot = stackedPlots?.[si],
			topValues = plot ? plot.cumulative : displayValues,
			pts = computeLinePoints(topValues, catCount, layout, range).map((point, index) => ({
				...point,
				x: xPositions?.[index] ?? point.x,
			})),
			c = seriesColor(series, si, chartData.colorPalette),
			lineStr = linePointsToSvgString(pts),
			firstPt = pts[0],
			lastPt = pts[pts.length - 1];
		if (plot) {
			// Stacked band: fill between this series' cumulative top and its own
			// base (the previous series' top), like a stream-graph layer, at full
			// opacity so adjacent bands read as distinct rather than washed.
			const baseStr = linePointsToSvgString(
				[
					...computeLinePoints(plot.base, catCount, layout, range).map((point, index) => ({
						...point,
						x: xPositions?.[index] ?? point.x,
					})),
				].reverse(),
			);
			primitives.push({
				kind: 'polyline',
				points: `${lineStr} ${baseStr}`,
				stroke: 'none',
				strokeWidth: 0,
				fill: c,
				part: { role: 'series', seriesIndex: si },
			} satisfies SvgPolyline);
		} else if (firstPt && lastPt) {
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
			const idx = sourceIndices[displayIndex] ?? displayIndex,
				part: ChartPartRef = { role: 'dataPoint', seriesIndex: si, pointIndex: idx };
			pushMarker(
				primitives,
				series,
				idx,
				pt.x,
				pt.y,
				resolveDataPointFill(series, idx, c) ?? c,
				2,
				part,
				undefined,
				buildMarkTooltip(
					series.name,
					chartData.categories[idx],
					series.values[idx] ?? 0,
					series.numberFormat,
				),
			);
		});
		if (showLabels) {
			const labelValues = plot ? plot.own : displayValues;
			labelValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
				if (!pt) {
					return;
				}
				if (isPercent) {
					if (val === 0) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: pt.x,
						y: pt.y - 6,
						text: `${Math.round(val)}%`,
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fill: '#334155',
						textAnchor: 'middle',
					});
					return;
				}
				// eslint-disable-next-line one-var -- an early return sits between this const and the previous one
				const pointIndex = sourceIndices[displayIndex] ?? displayIndex,
					label = buildDataLabelText({ chartData, series, pointIndex, value: val });
				if (label === undefined) {
					return;
				}
				const anchor = resolveMarkerLabelPlacement(
					chartData,
					series,
					pointIndex,
					pt,
					{ width: layout.svgWidth, height: layout.svgHeight },
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
