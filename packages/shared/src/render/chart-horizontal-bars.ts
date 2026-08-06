/**
 * chart-horizontal-bars.ts: transposed (horizontal) bar-chart view-model
 * builder for `c:barDir val="bar"` charts.
 *
 * The cartesian engine in `chart-cartesian.ts` is column-oriented: categories
 * run along the x axis and values up the y axis. A PowerPoint "Bar" chart is
 * the transpose (categories down the left, values along the bottom), so this
 * module builds that layout directly: vertical value gridlines, bottom value
 * labels, left-anchored category labels, and bars growing from the zero line
 * to the right. Clustered, stacked and percentStacked groupings are covered;
 * secondary-axis series, trendlines and data tables fall outside this builder
 * (charts using those keep the column engine's vertical rendering).
 *
 * @module chart-horizontal-bars
 */
import type { PptxChartData, PptxChartSeries, PptxElement } from 'pptx-viewer-core';

import { computeValueRangeForChart } from './chart-axis-range';
import { resolveDataPointFill, resolveVaryColorFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX } from './chart-font';
import type {
	ChartViewModel,
	PlotLayout,
	SvgLine,
	SvgPrimitive,
	SvgRect,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	AXIS_LABEL_COLOR,
	GRIDLINE_COLOR,
	ZERO_LINE_COLOR,
	axisTickValues,
	buildLegend,
	computePlotLayout,
	computeStackedValueRange,
	formatAxisValue,
	paletteColor,
	seriesColor,
} from './chart-view-model';

/** Map a value onto the horizontal (x) axis: min at the left, max at the right. */
export function valueToX(val: number, range: ValueRange, leftX: number, rightX: number): number {
	const usable = rightX - leftX;
	let ratio: number;
	if (range.logScale && range.logBase) {
		const base = range.logBase;
		const clampedVal = Math.max(val, range.min);
		const logVal = Math.log(clampedVal) / Math.log(base);
		const logMin = Math.log(range.min) / Math.log(base);
		ratio = (logVal - logMin) / range.span;
	} else {
		ratio = (val - range.min) / range.span;
	}
	return range.reverseOrder ? rightX - ratio * usable : leftX + ratio * usable;
}

/** Vertical value gridlines + bottom tick labels (the transposed value axis). */
function buildTransposedValueAxis(
	range: ValueRange,
	layout: PlotLayout,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [];
	const axisLabels: SvgText[] = [];
	for (const val of axisTickValues(range)) {
		const x = valueToX(val, range, layout.plotLeft, layout.plotRight);
		gridlines.push({
			kind: 'line',
			x1: x,
			y1: layout.plotTop,
			x2: x,
			y2: layout.plotBottom,
			stroke: GRIDLINE_COLOR,
			strokeWidth: 1,
		});
		axisLabels.push({
			kind: 'text',
			x,
			y: layout.plotBottom + 12,
			text: formatAxisValue(val),
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'middle',
		});
	}
	return { gridlines, axisLabels };
}

/** Left-anchored category labels, one per band, centred on the band. */
function buildSideCategoryLabels(
	categoryLabels: ReadonlyArray<string>,
	layout: PlotLayout,
): SvgText[] {
	const catCount = Math.max(categoryLabels.length, 1);
	const band = layout.plotHeight / catCount;
	return categoryLabels.map((label, i) => ({
		kind: 'text' as const,
		x: layout.plotLeft - 4,
		y: layout.plotTop + band * (i + 0.5),
		text: label,
		fontSize: DEFAULT_CHART_TEXT_PX,
		fill: AXIS_LABEL_COLOR,
		textAnchor: 'end' as const,
		dominantBaseline: 'central',
	}));
}

/** Per-category absolute totals (for percentStacked normalisation). */
function categoryTotals(series: ReadonlyArray<PptxChartSeries>, catCount: number): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
	);
}

/** Resolve the fill for one bar, honouring dPt overrides and varyColors. */
function barFill(
	chartData: PptxChartData,
	series: PptxChartSeries,
	seriesIndex: number,
	pointIndex: number,
): string {
	const palette = chartData.colorPalette;
	if (chartData.varyColors === true && chartData.series.length === 1) {
		return resolveVaryColorFill(series, pointIndex, paletteColor(pointIndex, palette));
	}
	return (
		resolveDataPointFill(series, pointIndex, paletteColor(seriesIndex, palette)) ??
		seriesColor(series, seriesIndex, palette)
	);
}

/**
 * Build the full horizontal-bar view-model. Mirrors the column engine's
 * clustered / stacked / percentStacked geometry with the axes transposed.
 */
export function buildHorizontalBarViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const catCount = Math.max(categoryLabels.length, 1);
	const series = chartData.series;
	const grouping = chartData.grouping ?? 'clustered';
	const isStacked = grouping === 'stacked' || grouping === 'percentStacked';
	const isPercent = grouping === 'percentStacked';

	const range: ValueRange = isPercent
		? { min: 0, max: 100, span: 100 }
		: isStacked
			? computeStackedValueRange(series, catCount)
			: computeValueRangeForChart(series, chartData.axes);

	const { gridlines, axisLabels } = buildTransposedValueAxis(range, layout);
	const zeroX = valueToX(0, range, layout.plotLeft, layout.plotRight);
	const zeroLine: SvgLine | undefined =
		range.min < 0 && range.max > 0
			? {
					kind: 'line',
					x1: zeroX,
					y1: layout.plotTop,
					x2: zeroX,
					y2: layout.plotBottom,
					stroke: ZERO_LINE_COLOR,
					strokeWidth: 1,
				}
			: undefined;

	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];
	const showLabels = chartData.style?.hasDataLabels;
	const band = layout.plotHeight / catCount;

	if (!isStacked) {
		const seriesCount = Math.max(series.length, 1);
		const singleBarHeight =
			chartData.barGapWidth !== undefined
				? band / (seriesCount + Math.max(chartData.barGapWidth, 0) / 100)
				: (band * 0.7) / seriesCount;
		const overlap = chartData.barOverlap ?? 0;
		const step = singleBarHeight * (1 - overlap / 100);
		const clusterHeight = singleBarHeight + step * (seriesCount - 1);
		const groupOffset = (band - clusterHeight) / 2;

		for (let ci = 0; ci < catCount; ci++) {
			for (let si = 0; si < series.length; si++) {
				const val = series[si].values[ci] ?? 0;
				const y = layout.plotTop + band * ci + groupOffset + step * si;
				const valX = valueToX(val, range, layout.plotLeft, layout.plotRight);
				const x = Math.min(zeroX, valX);
				const w = Math.max(Math.abs(valX - zeroX), 1);
				primitives.push({
					kind: 'rect',
					x,
					y,
					w,
					h: singleBarHeight,
					fill: barFill(chartData, series[si], si, ci),
					rx: 1,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
				} satisfies SvgRect);
				if (showLabels) {
					dataLabels.push({
						kind: 'text',
						x: val >= 0 ? x + w + 4 : x - 4,
						y: y + singleBarHeight / 2,
						text: formatAxisValue(val, series[si].numberFormat),
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fill: '#334155',
						textAnchor: val >= 0 ? 'start' : 'end',
						dominantBaseline: 'central',
					});
				}
			}
		}
	} else {
		const totals = isPercent ? categoryTotals(series, catCount) : [];
		const barH = band * (isPercent ? 0.6 : 0.7);
		const barOffset = (band - barH) / 2;
		for (let ci = 0; ci < catCount; ci++) {
			let posRunning = 0;
			let negRunning = 0;
			const catTotal = isPercent ? totals[ci] || 1 : 1;
			for (let si = 0; si < series.length; si++) {
				const rawVal = series[si].values[ci] ?? 0;
				const val = isPercent ? (rawVal / catTotal) * 100 : rawVal;
				if (val === 0) {
					continue;
				}
				const isNeg = val < 0;
				const base = isNeg ? negRunning : posRunning;
				const top = base + val;
				const y = layout.plotTop + band * ci + barOffset;
				const baseX = valueToX(base, range, layout.plotLeft, layout.plotRight);
				const topX = valueToX(top, range, layout.plotLeft, layout.plotRight);
				const x = Math.min(baseX, topX);
				const w = Math.max(Math.abs(topX - baseX), 0.5);
				primitives.push({
					kind: 'rect',
					x,
					y,
					w,
					h: barH,
					fill: barFill(chartData, series[si], si, ci),
					rx: 1,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
				} satisfies SvgRect);
				if (showLabels && Math.abs(val) > 0) {
					dataLabels.push({
						kind: 'text',
						x: x + w / 2,
						y: y + barH / 2,
						text: isPercent
							? `${Math.round(val)}%`
							: formatAxisValue(rawVal, series[si].numberFormat),
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fill: isPercent ? '#ffffff' : '#334155',
						textAnchor: 'middle',
						dominantBaseline: 'central',
						...(isPercent ? { fontWeight: 'bold' as const } : {}),
					});
				}
				if (isNeg) {
					negRunning += val;
				} else {
					posRunning += val;
				}
			}
		}
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: chartData.style?.hasTitle && chartData.title ? chartData.title : undefined,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: buildSideCategoryLabels(categoryLabels, layout),
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
