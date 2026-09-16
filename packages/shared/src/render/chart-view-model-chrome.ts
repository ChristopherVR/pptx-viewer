/**
 * chart-view-model-chrome.ts: chart chrome (value-axis gridlines/labels, zero
 * line, category labels, legend placement) shared by the cartesian chart
 * kinds. Split out of `chart-view-model-layout.ts` to keep that module's plot
 * layout math under the repo's 300-LOC file guideline; re-exported by
 * `chart-view-model.ts`.
 *
 * @module chart-view-model-chrome
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartSeries } from 'pptx-viewer-core';

import { DEFAULT_CHART_TEXT_PX } from './chart-font';
import { resolveLegendPlacement } from './chart-legend-placement';
import { formatAxisValue, seriesColor, valueToY } from './chart-view-model-scale';
import type { ValueRange } from './chart-view-model-scale';
import type { LegendEntry, PlotLayout, SvgLine, SvgText } from './chart-view-model-types';

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
