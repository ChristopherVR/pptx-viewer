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

import { findValueAxis, buildValueAxisGridlinesAndLabels } from './chart-cx-axis-units';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { ChartViewModel, SvgLine, SvgRect, SvgText } from './chart-view-model';
import {
	buildLegend,
	buildZeroLine,
	buildCategoryLabels,
	computePlotLayout,
	formatAxisValue,
	valueToY,
} from './chart-view-model';
import { buildWaterfallSteps, computeWaterfallRange } from './chart-waterfall-layout';

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall colours (mirrors React renderWaterfallChart)
// ─────────────────────────────────────────────────────────────────────────────

const WF_COLOR_POSITIVE = '#22c55e';
const WF_COLOR_NEGATIVE = '#ef4444';
const WF_COLOR_TOTAL = '#6366f1';
const WF_CONNECTOR_COLOR = '#94a3b8';

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
	const range = computeWaterfallRange(steps);
	const catCount = Math.max(categoryLabels.length, values.length, 1);

	const barWidth = (layout.plotWidth / catCount) * 0.6;
	const gap = (layout.plotWidth / catCount) * 0.2;

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
		const barColor = isSubtotal
			? WF_COLOR_TOTAL
			: value >= 0
				? WF_COLOR_POSITIVE
				: WF_COLOR_NEGATIVE;

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

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

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
