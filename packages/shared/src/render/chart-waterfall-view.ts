/**
 * View-model builder for the waterfall chart kind.
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports this) to keep that
 * file's two unrelated chart kinds (waterfall, regionMap) each under the
 * repo's per-file line budget.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-waterfall-combo.tsx  (waterfall only)
 *
 * Waterfall - running-total bars with positive/negative/total colouring and
 *             dashed connector lines between bars.
 *
 * @module chart-waterfall-view
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { findValueAxis, buildValueAxisGridlinesAndLabels } from './chart-cx-axis-units';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { resolveLegendAnchorPosition } from './chart-legend-build';
import type { ChartViewModel, LegendEntry, SvgLine, SvgRect, SvgText } from './chart-view-model';
import {
	buildZeroLine,
	buildCategoryLabels,
	computePlotLayout,
	formatAxisValue,
	valueToY,
} from './chart-view-model';
import { paletteColor } from './chart-view-model-scale';
import { buildWaterfallSteps, computeWaterfallRange } from './chart-waterfall-layout';

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall colours: PowerPoint paints the three bar roles with the chart's
// first three palette colours, Increase / Decrease / Total (COM-verified,
// charts-com.pptx slide 26: #156082 / #E97132 / #196B24, the Office 2023
// theme's accent1..3). The legend below uses the same three, in this order.
// ─────────────────────────────────────────────────────────────────────────────

const WF_CONNECTOR_COLOR = '#94a3b8';

/** The Increase / Decrease / Total colours for a waterfall's palette. */
export function waterfallRoleColors(colorPalette: readonly string[] | undefined): {
	increase: string;
	decrease: string;
	total: string;
} {
	return {
		increase: paletteColor(0, colorPalette),
		decrease: paletteColor(1, colorPalette),
		total: paletteColor(2, colorPalette),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildWaterfallViewModel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the view-model for a waterfall chart.
 *
 * Each bar starts from the running total of all previous values; the last bar
 * shows the grand total (reset to 0 base).  Positive values get a green fill,
 * negative values get a red fill, and the final total bar uses indigo.
 * Dashed connector lines join adjacent bar tops/bottoms.
 *
 * Mirrors `renderWaterfallChart` in React's `chart-waterfall-combo.tsx`.
 */
export function buildWaterfallViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const series = chartData.series[0];
	const values = series?.values ?? [];
	const steps = buildWaterfallSteps(values, series?.waterfallOptions);
	const range = computeWaterfallRange(steps, layout.autoPlotHeight);
	const catCount = Math.max(categoryLabels.length, values.length, 1);

	const barWidth = (layout.plotWidth / catCount) * 0.6;
	const gap = (layout.plotWidth / catCount) * 0.2;

	const roles = waterfallRoleColors(chartData.colorPalette);
	const primitives: Array<SvgRect | SvgLine> = [];
	const dataLabels: SvgText[] = [];

	for (const step of steps) {
		const { sourceIndex, value, startValue, endValue, isSubtotal } = step;
		const barStartY = valueToY(startValue, range, layout.plotTop, layout.plotBottom);
		const barEndY = valueToY(endValue, range, layout.plotTop, layout.plotBottom);
		const i = sourceIndex;
		const x = layout.plotLeft + (layout.plotWidth / catCount) * i + gap;
		const y = Math.min(barStartY, barEndY);
		const h = Math.max(Math.abs(barEndY - barStartY), 1);
		const barColor = isSubtotal ? roles.total : value >= 0 ? roles.increase : roles.decrease;

		primitives.push({
			kind: 'rect',
			x,
			y,
			w: barWidth,
			h,
			fill: barColor,
			rx: 1,
			part: { role: 'dataPoint', seriesIndex: 0, pointIndex: sourceIndex },
		} satisfies SvgRect);

		if (chartData.style?.hasDataLabels) {
			dataLabels.push({
				kind: 'text',
				x: x + barWidth / 2,
				y: y - 4,
				text: formatAxisValue(value),
				fontSize: DEFAULT_CHART_DATA_LABEL_PX,
				fill: '#334155',
				textAnchor: 'middle',
				...(series
					? dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series, sourceIndex))
					: {}),
			} satisfies SvgText);
		}

		// Connector line to the next bar (not drawn after the last bar).
		if (series?.waterfallOptions?.connectorLines !== false && i < values.length - 1) {
			const nextX = layout.plotLeft + (layout.plotWidth / catCount) * (i + 1) + gap;
			primitives.push({
				kind: 'line',
				x1: x + barWidth,
				y1: barEndY,
				x2: nextX,
				y2: barEndY,
				stroke: WF_CONNECTOR_COLOR,
				strokeWidth: 0.8,
				dashArray: '3 2',
			} satisfies SvgLine);
		}
	}

	const { gridlines, axisLabels } = buildValueAxisGridlinesAndLabels(
		range,
		layout,
		findValueAxis(chartData.axes),
	);
	const zeroLine = buildZeroLine(range, layout);
	const catLabels = buildCategoryLabels(categoryLabels, layout, 'bar');

	// A waterfall's legend always lists its three fixed bar roles, never the
	// authored series (there is exactly one, and it never appears by name):
	// COM-verified against charts-com.pptx slide 26, whose legend reads
	// "Increase / Decrease / Total" in that order and colour.
	const legendPos = chartData.style?.legendPosition ?? 'b';
	const legend: LegendEntry[] = [
		{ color: roles.increase, label: 'Increase' },
		{ color: roles.decrease, label: 'Decrease' },
		{ color: roles.total, label: 'Total' },
	];
	const { legendX, legendY, legendAnchor } = resolveLegendAnchorPosition(
		layout.svgWidth,
		layout.svgHeight,
		layout.plotTop,
		legendPos,
	);

	const title = resolveChartTitleText(chartData);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
