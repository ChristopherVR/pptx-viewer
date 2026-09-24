/**
 * chart-scatter-x-axis.ts: a genuine "nice" VALUE axis for a scatter/bubble
 * chart's X axis (Excel-style automatic min/max/major-unit, vertical
 * gridlines), reusing the exact same maths the Y value axis already gets.
 *
 * OOXML gives a scatter/bubble chart TWO `c:valAx` elements (never a
 * `c:catAx`): one `axPos="l"` (the Y axis every cartesian kind already
 * scales), one `axPos="b"` (the X axis). The engine used to treat that X
 * axis as a row of evenly-spaced CATEGORY labels (`chartData.categories`,
 * itself a side effect of the embedded-workbook fallback reading the X
 * column generically), so it drew the raw data values themselves as tick
 * labels with no gridlines at all, instead of PowerPoint's own rounded
 * "0, 0.5, 1, 1.5, ..." scale with a vertical gridline at each tick.
 *
 * Reuses `computeValueRangeForAxis` (the same automatic-scale + `c:min`/
 * `c:max`/`c:majorUnit` honouring the Y axis uses) by feeding it "pseudo
 * series" whose `values` are each real series' X data
 * (`seriesXValues`), so a single well-tested function produces both axes'
 * bounds with no separate min/max algorithm to drift.
 *
 * @module chart-scatter-x-axis
 */
import type { PptxChartAxisFormatting, PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { computeValueRangeForAxis, generateAxisTicks } from './chart-axis';
import { buildVerticalStyledGridline } from './chart-axis-primitives';
import { chartAxisTextStyle } from './chart-axis-style';
import { tickLine } from './chart-category-axis';
import { DEFAULT_CHART_TEXT_PX } from './chart-font';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { formatAxisValue, seriesXValues, valueToY } from './chart-view-model';

const GRIDLINE_COLOR = '#e2e8f0';
const TICK_COUNT = 5;
const MAJOR_TICK_LENGTH = 4;

export interface ScatterXAxisPlan {
	/**
	 * The resolved X-axis range, in real data units (not pixels). `undefined`
	 * when not one series carries a finite X value (no `c:xVal` and no numeric
	 * `chartData.categories` to fall back to): there is no real X axis to
	 * scale, and callers keep their own point-order fallback instead of
	 * plotting everything at a meaningless {min:0, max:1}.
	 */
	range: ValueRange | undefined;
	gridlines: SvgLine[];
	labels: SvgText[];
	/** Map a real X value to its pixel X inside the plot box. Identity when `range` is `undefined`. */
	toPixelX: (value: number) => number;
}

/** The `c:valAx` positioned at the bottom: a scatter/bubble chart's X axis. */
function findScatterXAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	return (
		axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos === 'b') ??
		axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos !== 'l')
	);
}

/**
 * Build the nice-scaled X-axis range, vertical gridlines/tick marks, bottom
 * tick labels, and a value-to-pixel mapper for a scatter or bubble chart.
 */
export function buildScatterXAxisPlan(
	chartData: PptxChartData,
	layout: PlotLayout,
): ScatterXAxisPlan {
	const xAxis = findScatterXAxis(chartData.axes);
	const perSeriesX = chartData.series.map((series) => seriesXValues(chartData, series));
	const hasFiniteX = perSeriesX.some((values) => values?.some((value) => Number.isFinite(value)));
	if (!hasFiniteX) {
		return { range: undefined, gridlines: [], labels: [], toPixelX: (value) => value };
	}
	const pseudoSeries: PptxChartSeries[] = chartData.series.map((series, index) => ({
		...series,
		values: [...(perSeriesX[index] ?? [])],
	}));
	const range = computeValueRangeForAxis(pseudoSeries, xAxis, layout.plotWidth);
	const toPixelX = (value: number): number =>
		valueToY(value, range, layout.plotRight, layout.plotLeft);

	const showGridlines = xAxis ? xAxis.majorGridlines === true : true;
	const gridlines: SvgLine[] = [];
	const labels: SvgText[] = [];
	const textStyle = chartAxisTextStyle(xAxis, DEFAULT_CHART_TEXT_PX);

	for (const tickValue of generateAxisTicks(range, xAxis, TICK_COUNT)) {
		const x = toPixelX(tickValue);
		if (showGridlines) {
			gridlines.push(
				buildVerticalStyledGridline(
					x,
					layout,
					xAxis?.majorGridlinesSpPr,
					GRIDLINE_COLOR,
					1,
					undefined,
					undefined,
				),
			);
		}
		const tick =
			xAxis && tickLine(x, layout.plotBottom, xAxis.majorTickMark, false, MAJOR_TICK_LENGTH, xAxis);
		if (tick) {
			gridlines.push(tick);
		}
		if (xAxis?.tickLblPos !== 'none') {
			labels.push({
				kind: 'text',
				x,
				y: layout.plotBottom + 12,
				text: formatAxisValue(tickValue, xAxis?.numFmt?.formatCode),
				textAnchor: 'middle',
				...textStyle,
			});
		}
	}

	return { range, gridlines, labels, toPixelX };
}
