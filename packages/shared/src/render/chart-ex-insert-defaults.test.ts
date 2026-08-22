import { describe, expect, it } from 'vitest';

import { buildChartExInsertData } from './chart-ex-insert-defaults';

describe('buildChartExInsertData', () => {
	it('returns undefined for chart types that use the generic default', () => {
		for (const chartType of [
			'bar',
			'line',
			'pie',
			'area',
			'scatter',
			'waterfall',
			'combo',
		] as const) {
			expect(buildChartExInsertData(chartType)).toBeUndefined();
		}
	});

	it('gives histogram raw observations and a binning option, not pre-binned categories', () => {
		const data = buildChartExInsertData('histogram');
		expect(data?.categories).toStrictEqual([]);
		expect(data?.series).toHaveLength(1);
		expect(data?.series[0].histogramOptions?.layout).toBe('histogram');
		expect(data?.series[0].values.length).toBeGreaterThan(5);
	});

	it('gives funnel one descending series over its stage categories', () => {
		const data = buildChartExInsertData('funnel');
		expect(data?.categories.length).toBe(data?.series[0].values.length);
		const values = data?.series[0].values ?? [];
		expect([...values].sort((a, b) => b - a)).toStrictEqual(values);
	});

	it('gives treemap a two-level leaf-first hierarchy matching the series length', () => {
		const data = buildChartExInsertData('treemap');
		expect(data?.categoryLevels).toHaveLength(2);
		const [leaves, parents] = data?.categoryLevels ?? [];
		expect(leaves).toHaveLength(data?.series[0].values.length ?? -1);
		expect(parents).toHaveLength(leaves.length);
		expect(new Set(parents).size).toBeGreaterThan(1);
	});

	it('gives sunburst the same hierarchy shape as treemap', () => {
		const treemap = buildChartExInsertData('treemap');
		const sunburst = buildChartExInsertData('sunburst');
		expect(sunburst?.categoryLevels).toStrictEqual(treemap?.categoryLevels);
	});

	it('gives box-and-whisker several one-observation-per-category series', () => {
		const data = buildChartExInsertData('boxWhisker');
		expect(data?.categories.length).toBeGreaterThan(1);
		expect(data?.series.length).toBeGreaterThan(3);
		for (const series of data?.series ?? []) {
			expect(series.values).toHaveLength(data?.categories.length ?? -1);
		}
		expect(data?.series[0].boxWhiskerOptions?.quartileMethod).toBe('exclusive');
	});

	it('gives region map categories that resolve to a real region', () => {
		const data = buildChartExInsertData('regionMap');
		expect(data?.categories).toContain('United States');
		expect(data?.series[0].regionMapOptions?.viewedRegionType).toBe('world');
		expect(data?.series[0].values).toHaveLength(data?.categories.length ?? -1);
	});
});
