import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import {
	chartDataChangeType,
	isParetoChartData,
	resolveDisplayedChartTypeName,
} from 'pptx-viewer-core';

import { buildSecondaryAxis } from './chart-axis-render';
import type { PlotLayout, SvgCircle, SvgPolyline, SvgPrimitive, SvgText } from './chart-view-model';

export interface ParetoEntry {
	value: number;
	label: string;
	sourcePointIndex: number;
}

/**
 * Running cumulative total, expressed as a percentage of the grand total, in
 * the order given (no reordering). Rounded to 2 decimal places, matching how
 * PowerPoint labels a Pareto chart's cumulative line.
 *
 * Shared by the insert-chart "Pareto" default ({@link ../render/chart-ex-insert-defaults})
 * and the Change Chart Type "Pareto" conversion ({@link ../render/chart-editor-options})
 * so both build the same cumulative-percentage-of-total representation that
 * `docs/guide/limitations.md` documents: `chartType: "histogram"` with a
 * `clusteredColumn`-layout frequency series and a `paretoLine`-layout
 * cumulative-percentage series.
 */
export function cumulativePercentOfTotal(values: ReadonlyArray<number>): number[] {
	const total = values.reduce((sum, value) => sum + value, 0);
	if (total === 0) {
		return values.map(() => 0);
	}
	let running = 0;
	return values.map((value) => {
		running += value;
		return Math.round((running / total) * 10000) / 100;
	});
}

/**
 * Convert to the "Pareto" representation this SDK models: `chartType:
 * 'histogram'` with the existing first series left as the frequency bars
 * (`clusteredColumn` at the OOXML layer, since `buildSeries` in
 * `chart-cx-generator.ts` only writes `paretoLine` for a series whose
 * `histogramOptions.layout` is `'pareto'`) plus an appended cumulative-percent
 * series, unless one is already present (re-selecting "Pareto" is then a
 * no-op past the type change). The cumulative series is computed over the
 * frequency values sorted descending, matching the order
 * `buildHistogramViewModel` displays them in once `paretoIndex >= 0`.
 *
 * Mirrors the MCP `createChart`/`updateChart` tools' `chartType: "pareto"`
 * alias (`applyParetoChartTypeAlias` in `pptx-viewer-mcp`), which builds the
 * same shape for AI-driven edits; this is the UI-facing equivalent used by
 * `chart-editor-options.ts`'s `patchChartData` for the Change Chart Type
 * picker.
 */
export function applyParetoConversion(data: PptxChartData): PptxChartData {
	const histogramData = chartDataChangeType(data, 'histogram');
	const [frequency] = histogramData.series;
	if (!frequency) {
		return histogramData;
	}
	const hasParetoLine = histogramData.series.some(
		(series) => series.histogramOptions?.layout === 'pareto',
	);
	if (hasParetoLine) {
		return histogramData;
	}
	const sortedDescending = [...frequency.values].sort((a, b) => Math.max(b, 0) - Math.max(a, 0));
	return {
		...histogramData,
		series: [
			...histogramData.series,
			{
				name: 'Cumulative %',
				values: cumulativePercentOfTotal(sortedDescending),
				histogramOptions: { layout: 'pareto' },
			},
		],
	};
}

/** Sort by descending non-negative frequency while retaining stable source mapping. */
export function orderParetoEntries(entries: ReadonlyArray<ParetoEntry>): ParetoEntry[] {
	return [...entries].sort(
		(left, right) =>
			Math.max(right.value, 0) - Math.max(left.value, 0) ||
			left.sourcePointIndex - right.sourcePointIndex,
	);
}

/** Build cumulative percentage line marks in Pareto display order. */
export function buildParetoPrimitives(
	entries: ReadonlyArray<ParetoEntry>,
	layout: PlotLayout,
	series: PptxChartSeries,
	seriesIndex: number,
): SvgPrimitive[] {
	const total = entries.reduce((sum, entry) => sum + Math.max(entry.value, 0), 0);
	if (total <= 0) {
		return [];
	}
	let cumulative = 0;
	const points = entries.map((entry, displayIndex) => {
		cumulative += Math.max(entry.value, 0);
		const percentage = displayIndex === entries.length - 1 ? 100 : (cumulative / total) * 100;
		return {
			x: layout.plotLeft + (layout.plotWidth * (displayIndex + 0.5)) / entries.length,
			y: layout.plotBottom - (layout.plotHeight * percentage) / 100,
			pointIndex: entry.sourcePointIndex,
		};
	});
	const color = series.color ?? '#ED7D31';
	return [
		{
			kind: 'polyline',
			points: points.map((point) => `${point.x},${point.y}`).join(' '),
			stroke: color,
			strokeWidth: 2,
			fill: 'none',
			part: { role: 'series', seriesIndex },
		} satisfies SvgPolyline,
		...points.map(
			(point) =>
				({
					kind: 'circle',
					cx: point.x,
					cy: point.y,
					r: 2.5,
					fill: color,
					part: { role: 'dataPoint', seriesIndex, pointIndex: point.pointIndex },
				}) satisfies SvgCircle,
		),
	];
}

/**
 * True when `data` is the shape this SDK models as "Pareto": `chartType:
 * 'histogram'` with at least one series whose `histogramOptions.layout` is
 * `'pareto'` (the cumulative-percentage line `applyParetoConversion` appends).
 * Pareto has no `PptxChartType` of its own (see docs/guide/limitations.md's
 * ChartEx row), so this is the only way to recognise one from data alone.
 *
 * Delegates to `pptx-viewer-core`'s `isParetoChartData` so the detection
 * logic has one implementation shared with `pptx-viewer-mcp`, which cannot
 * import from this (internal, per-binding-bundled) package.
 */
export function isParetoChart(data: Pick<PptxChartData, 'chartType' | 'series'>): boolean {
	return isParetoChartData(data);
}

/**
 * The chart type a type picker or inspector should show as "current" /
 * "selected". `data.chartType` alone reads a Pareto chart back as
 * `'histogram'` because Pareto is a display-only overlay on the histogram
 * shape (see {@link applyParetoConversion}); this restores the round trip for
 * display purposes only; it never changes what is stored or serialized.
 *
 * Consumed by every binding's Change Chart Type picker and chart-type
 * inspector label so re-opening a Pareto chart shows "Pareto", not
 * "Histogram", without introducing a `PptxChartType` of `'pareto'`.
 *
 * Delegates to `pptx-viewer-core`'s `resolveDisplayedChartTypeName` (see
 * {@link isParetoChart}).
 */
export function resolveDisplayedChartType(
	data: Pick<PptxChartData, 'chartType' | 'series'>,
): PptxChartData['chartType'] | 'pareto' {
	return resolveDisplayedChartTypeName(data);
}

/** Build the fixed Pareto percentage axis using shared secondary-axis conventions. */
export function buildParetoAxis(layout: PlotLayout): {
	secondaryGridlines: ReturnType<typeof buildSecondaryAxis>['gridlines'];
	secondaryAxisLabels: SvgText[];
} {
	const axis = buildSecondaryAxis({ min: 0, max: 100, span: 100 }, layout, {
		axisType: 'valAx',
		axPos: 'r',
		majorUnit: 20,
		majorTickMark: 'out',
	});
	return {
		secondaryGridlines: axis.gridlines,
		secondaryAxisLabels: axis.axisLabels.map((label) => ({
			...label,
			text: `${label.text}%`,
		})),
	};
}
