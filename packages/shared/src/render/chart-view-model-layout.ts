/**
 * chart-view-model-layout.ts: plot-area layout and chart chrome (gridlines,
 * axis / category labels, legend placement) of the chart engine. Split out of
 * `chart-view-model.ts`, which re-exports everything here.
 *
 * @module chart-view-model-layout
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { chartFontPx, DEFAULT_CHART_TEXT_PX } from './chart-font';
import { reserveLegendSpace, resolveLegendPlacement } from './chart-legend-placement';
import { manualLayoutOf, resolveManualLayoutRect } from './chart-manual-layout';
import { formatAxisValue, seriesColor, valueToY } from './chart-view-model-scale';
import type { ValueRange } from './chart-view-model-scale';
import type {
	LegendEntry,
	PlotLayout,
	PlotLayoutOptions,
	SvgLine,
	SvgText,
} from './chart-view-model-types';

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
		// `tr` (top-right corner) overlays the plot per PowerPoint's own
		// quick-layout behaviour: no band is reserved for it, unlike b/t/l/r.
		({ plotLeft, plotTop, plotRight, plotBottom } = reserveLegendSpace(legendPos, {
			plotLeft,
			plotTop,
			plotRight,
			plotBottom,
		}));
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

	// c:plotArea/c:layout/c:manualLayout: the author placed the plot area by
	// hand. Each field the layout omits keeps the automatic value above, which
	// is also what a `factor`-mode offset is relative to. An `outer` target
	// (the default) includes the axis labels, so the plot proper is inset by
	// the same bands the automatic layout reserves for them.
	const plotLayout = manualLayoutOf(chartData, 'plotArea'),
		manual = resolveManualLayoutRect(
			plotLayout,
			{ width: svgWidth, height: svgHeight },
			{ x: plotLeft, y: plotTop, width: plotRight - plotLeft, height: plotBottom - plotTop },
		);
	if (plotLayout && manual) {
		plotLeft = manual.x;
		plotTop = manual.y;
		plotRight = manual.x + manual.width;
		plotBottom = manual.y + manual.height;
		if (hasAxes && plotLayout.layoutTarget !== 'inner') {
			plotLeft += 40;
			plotBottom -= categoryAxisBand(chartData) - 8;
		}
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
	/**
	 * `false` keeps the tick labels but draws no gridlines: a value axis whose
	 * `c:majorGridlines` is absent (see `shouldRenderMajorGridlines`).
	 */
	showMajorGridlines = true,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [],
		axisLabels: SvgText[] = [];

	for (const val of axisTickValues(range)) {
		const y = valueToY(val, range, layout.plotTop, layout.plotBottom);

		if (showMajorGridlines) {
			gridlines.push({
				kind: 'line',
				x1: layout.plotLeft,
				y1: y,
				x2: layout.plotRight,
				y2: y,
				stroke: GRIDLINE_COLOR,
				strokeWidth: 1,
			});
		}

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

	// `tr` shares `'r'`'s coordinates (a right-aligned column starting at
	// plotTop): that is already "top-right corner"; it just does not reserve
	// plot-area space the way a reserved `'r'` legend does (see computePlotLayout).
	const side = resolveLegendPlacement(legendPos).side;
	if (side === 'r') {
		legendX = svgWidth - 75;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (side === 'l') {
		legendX = 4;
		legendY = plotTop;
		legendAnchor = 'start';
	} else if (side === 't') {
		legendY = 28;
	}

	return { legend, legendX, legendY, legendAnchor };
}
