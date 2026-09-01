/**
 * `chart-secondary-axis` - the pure axisId-from-checkbox logic behind the
 * inspector's "Use secondary axis" toggle for a single chart series.
 *
 * WHY this lives in shared: `c:ser/c:axId` links a series to one of the
 * chart's `c:valAx`/`c:catAx` pairs by numeric id, not by a `'primary' |
 * 'secondary'` label, so the inspector has to resolve the checkbox state
 * through `chartData.axes` both ways: reading which axis a series currently
 * targets, and picking the right-positioned (`axPos: 'r'`) axis's id to write
 * back when the box is checked. Vanilla's `chart-exhaustive-section.ts` had
 * this logic inline; extracted here so the other four bindings do not have to
 * re-derive it.
 *
 * NOTE: `chart-axis.ts` already exports an `isSeriesOnSecondaryAxis(series,
 * axes)` (a `PptxChartSeries` + axis array pair, used by the cartesian-combo
 * axis-splitting code). {@link isSeriesUsingSecondaryAxis} below is named
 * differently to avoid a duplicate-export clash on the shared barrel, and
 * delegates to that existing function instead of re-deriving the same check,
 * only adapting the chartData+index shape the inspector checkbox wants.
 *
 * @module render/chart-secondary-axis
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { isSeriesOnSecondaryAxis as seriesIsOnSecondaryAxis } from './chart-axis';

/**
 * Whether the series at `seriesIndex` is currently plotted against the
 * secondary (right-positioned) value axis, i.e. its `axisId` resolves to a
 * `c:valAx` entry with `axPos === 'r'`. Thin chartData+index wrapper around
 * `chart-axis.ts`'s `isSeriesOnSecondaryAxis(series, axes)`.
 */
export function isSeriesUsingSecondaryAxis(chartData: PptxChartData, seriesIndex: number): boolean {
	const series = chartData.series[seriesIndex];
	if (!series) {
		return false;
	}
	return seriesIsOnSecondaryAxis(series, chartData.axes);
}

/**
 * Resolve the `axisId` a series should carry for the given "use secondary
 * axis" checkbox state: the right-positioned (`axPos: 'r'`) axis's id when
 * `useSecondary` is true, otherwise the left-positioned (`axPos: 'l'`)
 * axis's id. `undefined` when the chart has no axis at that position.
 */
export function resolveSecondaryAxisId(
	chartData: PptxChartData,
	useSecondary: boolean,
): number | undefined {
	const axPos = useSecondary ? 'r' : 'l';
	return chartData.axes?.find((axis) => axis.axPos === axPos)?.axisId;
}

/**
 * Build a `Partial<PptxChartData>` patch that moves the series at
 * `seriesIndex` onto the primary or secondary value axis, leaving every
 * other series and field untouched. No-op (returns `{}`) when the index is
 * out of range.
 */
export function seriesSecondaryAxisPatch(
	chartData: PptxChartData,
	seriesIndex: number,
	useSecondary: boolean,
): Partial<PptxChartData> {
	const series = chartData.series[seriesIndex];
	if (!series) {
		return {};
	}
	const next = [...chartData.series];
	next[seriesIndex] = { ...series, axisId: resolveSecondaryAxisId(chartData, useSecondary) };
	return { series: next };
}
