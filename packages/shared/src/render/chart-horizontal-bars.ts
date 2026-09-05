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
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { computeValueRangeForChart } from './chart-axis-range';
import { resolveBarLabelPlacement } from './chart-data-label-anchor';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import {
	barFill,
	buildSideCategoryLabels,
	buildTransposedValueAxis,
	categoryTotals,
	valueToX,
} from './chart-horizontal-bars-helpers';
import type {
	ChartViewModel,
	SvgLine,
	SvgPrimitive,
	SvgRect,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	ZERO_LINE_COLOR,
	buildLegend,
	buildMarkTooltip,
	computePlotLayout,
	computeStackedValueRange,
	formatAxisValue,
} from './chart-view-model';

export { valueToX } from './chart-horizontal-bars-helpers';

/**
 * Build the full horizontal-bar view-model. Mirrors the column engine's
 * clustered / stacked / percentStacked geometry with the axes transposed.
 */
export function buildHorizontalBarViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true),
		catCount = Math.max(categoryLabels.length, 1),
		series = chartData.series,
		grouping = chartData.grouping ?? 'clustered',
		isStacked = grouping === 'stacked' || grouping === 'percentStacked',
		isPercent = grouping === 'percentStacked',
		range: ValueRange = isPercent
			? { min: 0, max: 100, span: 100 }
			: isStacked
				? computeStackedValueRange(series, catCount)
				: computeValueRangeForChart(series, chartData.axes),
		{ gridlines, axisLabels } = buildTransposedValueAxis(range, layout),
		zeroX = valueToX(0, range, layout.plotLeft, layout.plotRight),
		zeroLine: SvgLine | undefined =
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
				: undefined,
		primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		showLabels = chartData.style?.hasDataLabels,
		band = layout.plotHeight / catCount;

	if (!isStacked) {
		const seriesCount = Math.max(series.length, 1),
			singleBarHeight =
				chartData.barGapWidth !== undefined
					? band / (seriesCount + Math.max(chartData.barGapWidth, 0) / 100)
					: (band * 0.7) / seriesCount,
			overlap = chartData.barOverlap ?? 0,
			step = singleBarHeight * (1 - overlap / 100),
			clusterHeight = singleBarHeight + step * (seriesCount - 1),
			groupOffset = (band - clusterHeight) / 2;

		for (let ci = 0; ci < catCount; ci++) {
			for (let si = 0; si < series.length; si++) {
				const val = series[si].values[ci] ?? 0,
					y = layout.plotTop + band * ci + groupOffset + step * si,
					valX = valueToX(val, range, layout.plotLeft, layout.plotRight),
					x = Math.min(zeroX, valX),
					w = Math.max(Math.abs(valX - zeroX), 1);
				primitives.push({
					kind: 'rect',
					x,
					y,
					w,
					h: singleBarHeight,
					fill: barFill(chartData, series[si], si, ci),
					rx: 1,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
					title: buildMarkTooltip(
						series[si].name,
						categoryLabels[ci],
						val,
						series[si].numberFormat,
					),
				} satisfies SvgRect);
				if (showLabels) {
					// c:dLblPos (ctr/inBase/inEnd/outEnd) decides where on the bar the
					// label sits; a per-point c:dLbl/c:layout drag shifts it further.
					const anchor = resolveBarLabelPlacement(
						chartData,
						series[si],
						ci,
						{ x, y, width: w, height: singleBarHeight },
						val,
						'horizontal',
						{ width: layout.svgWidth, height: layout.svgHeight },
					);
					dataLabels.push({
						kind: 'text',
						x: anchor.x,
						y: anchor.y,
						text: formatAxisValue(val, series[si].numberFormat),
						fontSize: DEFAULT_CHART_DATA_LABEL_PX,
						fill: '#334155',
						textAnchor: anchor.textAnchor,
						dominantBaseline: 'central',
						...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series[si], ci)),
					});
				}
			}
		}
	} else {
		const totals = isPercent ? categoryTotals(series, catCount) : [],
			barH = band * (isPercent ? 0.6 : 0.7),
			barOffset = (band - barH) / 2;
		for (let ci = 0; ci < catCount; ci++) {
			let posRunning = 0,
				negRunning = 0;
			const catTotal = isPercent ? totals[ci] || 1 : 1;
			for (let si = 0; si < series.length; si++) {
				const rawVal = series[si].values[ci] ?? 0,
					val = isPercent ? (rawVal / catTotal) * 100 : rawVal;
				if (val === 0) {
					continue;
				}
				// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
				const isNeg = val < 0,
					base = isNeg ? negRunning : posRunning,
					top = base + val,
					y = layout.plotTop + band * ci + barOffset,
					baseX = valueToX(base, range, layout.plotLeft, layout.plotRight),
					topX = valueToX(top, range, layout.plotLeft, layout.plotRight),
					x = Math.min(baseX, topX),
					w = Math.max(Math.abs(topX - baseX), 0.5);
				primitives.push({
					kind: 'rect',
					x,
					y,
					w,
					h: barH,
					fill: barFill(chartData, series[si], si, ci),
					rx: 1,
					part: { role: 'dataPoint', seriesIndex: si, pointIndex: ci },
					title: buildMarkTooltip(
						series[si].name,
						categoryLabels[ci],
						rawVal,
						series[si].numberFormat,
					),
				} satisfies SvgRect);
				if (showLabels && Math.abs(val) > 0) {
					if (isPercent) {
						// A percentStacked segment's label is always centred in the
						// segment (PowerPoint's own convention); dLblPos does not apply.
						dataLabels.push({
							kind: 'text',
							x: x + w / 2,
							y: y + barH / 2,
							text: `${Math.round(val)}%`,
							fontSize: DEFAULT_CHART_DATA_LABEL_PX,
							fill: '#ffffff',
							textAnchor: 'middle',
							dominantBaseline: 'central',
							fontWeight: 'bold',
							...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series[si], ci)),
						});
					} else {
						const anchor = resolveBarLabelPlacement(
							chartData,
							series[si],
							ci,
							{ x, y, width: w, height: barH },
							rawVal,
							'horizontal',
							{ width: layout.svgWidth, height: layout.svgHeight },
						);
						dataLabels.push({
							kind: 'text',
							x: anchor.x,
							y: anchor.y,
							text: formatAxisValue(rawVal, series[si].numberFormat),
							fontSize: DEFAULT_CHART_DATA_LABEL_PX,
							fill: '#334155',
							textAnchor: anchor.textAnchor,
							dominantBaseline: 'central',
							...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series[si], ci)),
						});
					}
				}
				if (isNeg) {
					negRunning += val;
				} else {
					posRunning += val;
				}
			}
		}
	}

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const legendPos = chartData.style?.legendPosition ?? 'b',
		{ legend, legendX, legendY, legendAnchor } = buildLegend(
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
