import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ChartRevealDescriptor } from './animation-timeline-types';
import {
	applyChartBuildReveal,
	applyChartRevealDescriptor,
	resolveRevealedChartData,
} from './chart-build';

function emptyReveal(overrides: Partial<ChartRevealDescriptor> = {}): ChartRevealDescriptor {
	return { background: true, series: new Set(), categories: new Set(), points: [], ...overrides };
}

function makeChartData(): PptxChartData {
	return {
		chartType: 'bar',
		title: 'T',
		categories: ['A', 'B', 'C', 'D'],
		series: [
			{ name: 'S1', values: [1, 2, 3, 4] },
			{ name: 'S2', values: [5, 6, 7, 8] },
			{ name: 'S3', values: [9, 10, 11, 12] },
		],
	} as PptxChartData;
}

describe('applyChartBuildReveal', () => {
	it('returns the same reference for asOne', () => {
		const data = makeChartData();
		expect(applyChartBuildReveal(data, { mode: 'asOne', progress: 0.5 })).toBe(data);
	});

	it('returns the same reference when fully revealed', () => {
		const data = makeChartData();
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 1 })).toBe(data);
	});

	it('bySeries reveals a leading prefix of series by progress', () => {
		const data = makeChartData();
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 0 }).series).toHaveLength(0);
		// 3 series: progress just above 0 reveals 1, ~1/2 reveals 2.
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 0.1 }).series).toHaveLength(1);
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 0.5 }).series).toHaveLength(2);
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 0.9 }).series).toHaveLength(3);
	});

	it('byCategory trims value tails but keeps every series and the category axis', () => {
		const data = makeChartData();
		const revealed = applyChartBuildReveal(data, { mode: 'byCategory', progress: 0.5 });
		// 4 categories, progress 0.5 -> 2 revealed.
		expect(revealed.series).toHaveLength(3);
		expect(revealed.categories).toStrictEqual(['A', 'B', 'C', 'D']);
		for (const s of revealed.series) {
			expect(s.values).toHaveLength(2);
		}
		expect(revealed.series[0].values).toStrictEqual([1, 2]);
	});

	it('byElement reveals cells in series-major order', () => {
		const data = makeChartData();
		// 3 series x 4 cats = 12 cells; progress 5/12 -> 5 cells: series0 all 4, series1 1.
		const revealed = applyChartBuildReveal(data, { mode: 'byElement', progress: 5 / 12 });
		expect(revealed.series[0].values).toStrictEqual([1, 2, 3, 4]);
		expect(revealed.series[1].values).toStrictEqual([5]);
		expect(revealed.series[2].values).toStrictEqual([]);
	});

	it('leaves an empty-series chart untouched', () => {
		const data = { ...makeChartData(), series: [] } as PptxChartData;
		expect(applyChartBuildReveal(data, { mode: 'bySeries', progress: 0.3 })).toBe(data);
	});
});

describe('applyChartRevealDescriptor', () => {
	it('bySeries keeps only the authored series set, in ANY order (reverse-order build)', () => {
		const data = makeChartData();
		// "Reverse Order" fires series 2 first, then 1: the SET is {2}, then {1,2}.
		const afterFirstClick = applyChartRevealDescriptor(
			data,
			'bySeries',
			emptyReveal({ series: new Set([2]) }),
		);
		expect(afterFirstClick.series.map((s) => s.name)).toStrictEqual(['S3']);

		const afterSecondClick = applyChartRevealDescriptor(
			data,
			'bySeries',
			emptyReveal({ series: new Set([1, 2]) }),
		);
		expect(afterSecondClick.series.map((s) => s.name)).toStrictEqual(['S2', 'S3']);
	});

	it('bySeries reveals nothing when the descriptor is empty', () => {
		const data = makeChartData();
		expect(applyChartRevealDescriptor(data, 'bySeries', emptyReveal()).series).toHaveLength(0);
	});

	it('byCategory keeps every series, trimming values to the authored (non-contiguous) category set', () => {
		const data = makeChartData();
		const revealed = applyChartRevealDescriptor(
			data,
			'byCategory',
			emptyReveal({ categories: new Set([0, 2]) }),
		);
		expect(revealed.series).toHaveLength(3);
		// Categories 0 and 2 (a gapped, not a leading-prefix, set) map back to the
		// ORIGINAL values at those indices for every series.
		expect(revealed.series[0].values).toStrictEqual([1, 3]);
		expect(revealed.series[1].values).toStrictEqual([5, 7]);
		expect(revealed.series[2].values).toStrictEqual([9, 11]);
	});

	it('byElement reveals only the authored (series, category) cells, per series', () => {
		const data = makeChartData();
		const revealed = applyChartRevealDescriptor(
			data,
			'byElement',
			emptyReveal({
				points: [
					{ seriesIdx: 0, categoryIdx: 3 },
					{ seriesIdx: 1, categoryIdx: 0 },
				],
			}),
		);
		expect(revealed.series[0].values).toStrictEqual([4]);
		expect(revealed.series[1].values).toStrictEqual([5]);
		expect(revealed.series[2].values).toStrictEqual([]);
	});

	it('asOne returns chartData unchanged', () => {
		const data = makeChartData();
		expect(applyChartRevealDescriptor(data, 'asOne', emptyReveal())).toBe(data);
	});
});

describe('resolveRevealedChartData', () => {
	it('prefers chartReveal over build when both are present', () => {
		const data = makeChartData();
		const revealed = resolveRevealedChartData(data, {
			build: { kind: 'chart', mode: 'bySeries', progress: 1 },
			chartReveal: { mode: 'bySeries', descriptor: emptyReveal({ series: new Set([0]) }) },
		});
		expect(revealed.series.map((s) => s.name)).toStrictEqual(['S1']);
	});

	it('falls back to the count-based build when chartReveal is absent', () => {
		const data = makeChartData();
		const revealed = resolveRevealedChartData(data, {
			build: { kind: 'chart', mode: 'bySeries', progress: 0.1 },
		});
		expect(revealed.series).toHaveLength(1);
	});

	it('returns chartData unchanged when neither is present', () => {
		const data = makeChartData();
		expect(resolveRevealedChartData(data, undefined)).toBe(data);
	});
});
