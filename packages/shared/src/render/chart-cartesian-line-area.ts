/**
 * chart-cartesian-line-area.ts: line and area plot-primitive builders for the
 * enriched cartesian chart engine, including stacked / percentStacked
 * geometry.
 *
 * Split out of `chart-cartesian-plots.ts` to keep each module within the
 * repo's ~300-LOC limit. Pure helpers consumed by `buildCartesianViewModel`;
 * they reuse the geometry primitives in `chart-view-model.ts`, the running-sum
 * math in `chart-stacked-series.ts`, and `pushMarker` from
 * `chart-cartesian-plots.ts` (shared with scatter).
 *
 * @module chart-cartesian-line-area
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { resolveBlankDisplay, visibleRuns } from './chart-blank-display';
import { pushMarker } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { buildDataLabelText } from './chart-data-label-text';
import { resolveDataPointFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { smoothLinePath } from './chart-line-path';
import { computeStackedSeriesPlots } from './chart-stacked-series';
import type { LineAreaStacking } from './chart-stacked-series';
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
	buildMarkTooltip,
	computeLinePoints,
	linePointsToSvgString,
	seriesColor,
	valueToY,
} from './chart-view-model';

/**
 * Build line-chart primitives, honouring a secondary value range per series
 * (clustered only: `stacking !== 'clustered'` always plots against
 * `primaryRange`, matching `isStacked` disabling the secondary-axis split in
 * chart-cartesian.ts).
 *
 * Stacked/percentStacked plots each series at its running-sum height (each
 * line sits on top of the ones below it, so the top-most line traces the
 * category total), computed from every series' own blank-resolved values via
 * `computeStackedSeriesPlots`. Data labels and marker tooltips still read the
 * series' own value (or percent share), not the cumulative height it is
 * plotted at, mirroring stacked bar's label convention.
 */
export function buildLines(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIdx: ReadonlySet<number>,
	sourceIndices: ReadonlyArray<number>,
	xPositions?: ReadonlyArray<number>,
	stacking: LineAreaStacking = 'clustered',
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		showLabels = chartData.style?.hasDataLabels,
		isStackedMode = stacking !== 'clustered',
		isPercent = stacking === 'percentStacked',
		// Resolve every series' own (blank-handled) values first: stacking needs
		// all of them at once to compute the running sums.
		resolved = chartData.series.map((series) => {
			if (series.values.length === 0) {
				return undefined;
			}
			const rawValues = sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0),
				displayBlanks = sourceIndices.map((sourceIndex) => series.blanks?.[sourceIndex] ?? false),
				// Honour c:dispBlanksAs: gap breaks the line at blanks, span interpolates,
				// zero/unset keep the placeholder 0 (existing behaviour).
				{ values: displayValues, visible } = resolveBlankDisplay(
					rawValues,
					displayBlanks,
					chartData.chartChrome?.dispBlanksAs,
				);
			return { displayValues, visible };
		}),
		stackedPlots = isStackedMode
			? computeStackedSeriesPlots(
					resolved.map((entry) => entry?.displayValues ?? []),
					catCount,
					isPercent,
				)
			: undefined;

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si],
			entry = resolved[si];
		if (!entry) {
			continue;
		}
		// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
		const { displayValues, visible } = entry,
			activeRange = isStackedMode
				? primaryRange
				: secondaryIdx.has(si) && secondaryRange
					? secondaryRange
					: primaryRange,
			plotValues = stackedPlots ? stackedPlots[si].cumulative : displayValues,
			pts = computeLinePoints(plotValues, catCount, layout, activeRange).map((point, index) => ({
				...point,
				x: xPositions?.[index] ?? point.x,
			})),
			c = seriesColor(series, si, chartData.colorPalette),
			// c:smooth draws a bezier path through the points; otherwise a polyline.
			seriesPart: ChartPartRef = { role: 'series', seriesIndex: si },
			allVisible = visible.every(Boolean);
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
			const idx = sourceIndices[displayIndex] ?? displayIndex,
				part: ChartPartRef = { role: 'dataPoint', seriesIndex: si, pointIndex: idx };
			pushMarker(
				primitives,
				series,
				idx,
				pt.x,
				pt.y,
				resolveDataPointFill(series, idx, c) ?? c,
				2.5,
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
			// percentStacked reads like the bar case: a plain rounded percent, not
			// routed through c:dLbls content options (showValue/showCategory/...),
			// since the plotted quantity is a derived share, not the raw datum.
			const labelValues = stackedPlots ? stackedPlots[si].own : displayValues;
			labelValues.forEach((val, displayIndex) => {
				const pt = pts[displayIndex];
				if (!pt || !visible[displayIndex]) {
					return;
				}
				if (isPercent) {
					if (val === 0) {
						return;
					}
					dataLabels.push({
						kind: 'text',
						x: pt.x,
						y: pt.y - 7,
						text: `${Math.round(val)}%`,
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fill: '#334155',
						textAnchor: 'middle',
					});
					return;
				}
				// eslint-disable-next-line one-var -- an early return sits between this const and the previous one
				const text = buildDataLabelText({
					chartData,
					series,
					pointIndex: sourceIndices[displayIndex] ?? displayIndex,
					value: val,
				});
				if (text === undefined) {
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
				const text = buildDataLabelText({
					chartData,
					series,
					pointIndex: sourceIndices[displayIndex] ?? displayIndex,
					value: val,
				});
				if (text === undefined) {
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
