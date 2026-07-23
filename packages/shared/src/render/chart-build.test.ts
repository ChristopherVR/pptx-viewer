import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyChartBuildReveal } from './chart-build';

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
