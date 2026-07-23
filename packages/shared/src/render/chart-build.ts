/**
 * `chart-build`: staged chart reveal (`p:bldChart`) projection.
 *
 * Given a chart's `PptxChartData` and the playback-time {@link ElementBuildState}
 * (chart variant) surfaced on an {@link ElementAnimationState}, produce a
 * trimmed copy of the chart data that exposes only the series / categories /
 * cells revealed so far. A staged renderer feeds the trimmed data through its
 * normal chart pipeline, so every chart kind reveals uniformly without any
 * per-kind knowledge here. `asOne` (or a fully-revealed build) returns the input
 * unchanged so the common whole-chart path stays allocation-free.
 *
 * @module render/chart-build
 */

import type { PptxChartData } from 'pptx-viewer-core';

import { revealedStageCount } from './animation-build';
import type { ChartBuildMode } from './animation-timeline-types';

/** The chart variant of a playback-time build state. */
export interface ChartBuildState {
	mode: ChartBuildMode;
	/** 0..1 fraction of the build revealed at the current playback time. */
	progress: number;
}

/** Number of categories spanned by a chart's data (labels or longest series). */
function categoryCount(chartData: PptxChartData): number {
	const longest = chartData.series.reduce((max, s) => Math.max(max, s.values.length), 0);
	return Math.max(chartData.categories.length, longest);
}

/**
 * Project a chart's data down to the stages revealed at `build.progress`.
 *
 *  - `bySeries`   reveal the first N whole series (count = series count).
 *  - `byCategory` reveal the first N categories across every series (count =
 *                 category count); series stay but their value tails are cut,
 *                 keeping the category axis stable.
 *  - `byElement`  reveal individual (series, category) cells in series-major
 *                 order (count = series x categories); each series keeps only
 *                 its revealed value prefix.
 *  - `asOne`      whole chart at once: returns `chartData` unchanged.
 *
 * The value axis may rescale to the revealed data (the shared engine derives its
 * range from the trimmed values); the category axis is preserved for the
 * per-category / per-cell modes so marks appear in place rather than sliding.
 */
export function applyChartBuildReveal(
	chartData: PptxChartData,
	build: ChartBuildState,
): PptxChartData {
	const { series } = chartData;
	if (build.mode === 'asOne' || series.length === 0) {
		return chartData;
	}

	if (build.mode === 'bySeries') {
		const shown = revealedStageCount(build.progress, series.length);
		if (shown >= series.length) {
			return chartData;
		}
		return { ...chartData, series: series.slice(0, shown) };
	}

	const catCount = categoryCount(chartData);
	if (catCount === 0) {
		return chartData;
	}

	if (build.mode === 'byCategory') {
		const shown = revealedStageCount(build.progress, catCount);
		if (shown >= catCount) {
			return chartData;
		}
		return {
			...chartData,
			series: series.map((s) => ({ ...s, values: s.values.slice(0, shown) })),
		};
	}

	// byElement: reveal cells one at a time in series-major order.
	const total = series.length * catCount;
	const shownCells = revealedStageCount(build.progress, total);
	if (shownCells >= total) {
		return chartData;
	}
	return {
		...chartData,
		series: series.map((s, si) => {
			const visibleInSeries = Math.max(0, Math.min(catCount, shownCells - si * catCount));
			return { ...s, values: s.values.slice(0, visibleInSeries) };
		}),
	};
}
