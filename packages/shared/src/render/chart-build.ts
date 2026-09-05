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
 * `applyChartRevealDescriptor` is the authored-index counterpart, consumed
 * instead of `applyChartBuildReveal` whenever a `ChartRevealDescriptor` (see
 * `chart-reveal-descriptor`) is available; `resolveRevealedChartData` is the
 * single entry point every binding's chart renderer should call, since it
 * picks between the two.
 *
 * @module render/chart-build
 */

import type { PptxChartData } from 'pptx-viewer-core';

import { revealedStageCount } from './animation-build';
import type {
	ChartBuildMode,
	ChartRevealDescriptor,
	ElementAnimationState,
} from './animation-timeline-types';

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

/**
 * Project a chart's data down to the AUTHORED reveal set named by a
 * {@link ChartRevealDescriptor} (see `chart-reveal-descriptor`), rather than a
 * click-count estimate. Correct for a reversed-order or gapped chart build,
 * where {@link applyChartBuildReveal}'s forward-prefix assumption is not.
 *
 *  - `bySeries`   keeps only the series named in `descriptor.series` (a Set,
 *                 so reveal order does not matter).
 *  - `byCategory` / `byElement` keep every series (the shared category axis
 *                 stays stable) but trim each series's values to the
 *                 categories revealed for it: `descriptor.categories` (a
 *                 whole-category reveal, applies to every series) unioned
 *                 with any `descriptor.points` naming that specific series.
 *  - `asOne`      returns `chartData` unchanged.
 */
export function applyChartRevealDescriptor(
	chartData: PptxChartData,
	mode: ChartBuildMode,
	descriptor: ChartRevealDescriptor,
): PptxChartData {
	const { series } = chartData;
	if (mode === 'asOne' || series.length === 0) {
		return chartData;
	}

	if (mode === 'bySeries') {
		return { ...chartData, series: series.filter((_, si) => descriptor.series.has(si)) };
	}

	return {
		...chartData,
		series: series.map((s, si) => {
			const revealedCategories = new Set(descriptor.categories);
			for (const point of descriptor.points) {
				if (point.seriesIdx === si) {
					revealedCategories.add(point.categoryIdx);
				}
			}
			if (revealedCategories.size === 0) {
				return { ...s, values: [] };
			}
			return { ...s, values: s.values.filter((_, ci) => revealedCategories.has(ci)) };
		}),
	};
}

/**
 * Resolve the chart data revealed at the current playback state, preferring
 * the authored-index {@link ChartRevealDescriptor} (`state.chartReveal`) over
 * the count-based `state.build` when both are available, and returning
 * `chartData` unchanged when neither applies. Every binding's chart element
 * renderer calls this in place of calling `applyChartBuildReveal` directly.
 */
export function resolveRevealedChartData(
	chartData: PptxChartData,
	state: Pick<ElementAnimationState, 'build' | 'chartReveal'> | undefined,
): PptxChartData {
	if (state?.chartReveal) {
		const { mode, descriptor } = state.chartReveal;
		return applyChartRevealDescriptor(chartData, mode, descriptor);
	}
	if (state?.build?.kind === 'chart') {
		return applyChartBuildReveal(chartData, state.build);
	}
	return chartData;
}
