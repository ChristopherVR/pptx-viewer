import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	hideChartSeries,
	restoreFilteredSeries,
	setDataLabelsRangeCache,
} from './chart-ext-editor-actions';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Cat1', 'Cat2'],
		series: [
			{ name: 'Series A', values: [1, 2] },
			{ name: 'Series B', values: [3, 4] },
		],
		...overrides,
	};
}

describe('hideChartSeries', () => {
	it('moves the series into filteredSeries, keeping its data', () => {
		const result = hideChartSeries(chart(), 1);
		expect(result?.series.map((s) => s.name)).toStrictEqual(['Series A']);
		expect(result?.filteredSeries).toStrictEqual([
			{ idx: 1, order: 1, name: 'Series B', categories: ['Cat1', 'Cat2'], values: [3, 4] },
		]);
	});

	it('refuses to hide the last visible series', () => {
		const oneSeries = chart({ series: [{ name: 'Only', values: [1, 2] }] });
		expect(hideChartSeries(oneSeries, 0)).toBeNull();
	});

	it('rejects an out-of-range index', () => {
		expect(hideChartSeries(chart(), 5)).toBeNull();
		expect(hideChartSeries(chart(), -1)).toBeNull();
	});

	it('picks a free idx when the natural one is already taken by another filtered series', () => {
		const data = chart({ filteredSeries: [{ idx: 0, order: 0, name: 'Already hidden' }] });
		const result = hideChartSeries(data, 0);
		expect(result?.filteredSeries).toHaveLength(2);
		expect(result?.filteredSeries?.[1]?.idx).not.toBe(0);
	});
});

describe('restoreFilteredSeries', () => {
	// A single visible series ("Series A") plus one filtered ("Series B"), the
	// realistic shape: a filtered series is NOT also present in `series`.
	function chartWithOneFiltered(overrides: Partial<PptxChartData> = {}): PptxChartData {
		return chart({
			series: [{ name: 'Series A', values: [1, 2] }],
			filteredSeries: [
				{ idx: 1, order: 1, name: 'Series B', categories: ['Cat1', 'Cat2'], values: [3, 4] },
			],
			...overrides,
		});
	}

	it('moves a filtered series back into series, using its own cached name/values', () => {
		const result = restoreFilteredSeries(chartWithOneFiltered(), 0);
		expect(result?.series.map((s) => s.name)).toStrictEqual(['Series A', 'Series B']);
		expect(result?.series[1]?.values).toStrictEqual([3, 4]);
		expect(result?.filteredSeries).toBeUndefined();
	});

	it('falls back to filteredSeriesTitle when the entry has no cached name', () => {
		const data = chartWithOneFiltered({
			filteredSeries: [{ idx: 1, order: 1, values: [5, 6] }],
			filteredSeriesTitle: 'Series 3',
		});
		const result = restoreFilteredSeries(data, 0);
		expect(result?.series[1]?.name).toBe('Series 3');
	});

	it('returns null for a missing index', () => {
		expect(restoreFilteredSeries(chart(), 0)).toBeNull();
	});

	it('keeps any OTHER still-filtered series in filteredSeries', () => {
		const data = chartWithOneFiltered({
			series: [{ name: 'Series A', values: [1, 2] }],
			filteredSeries: [
				{ idx: 1, order: 1, name: 'B', values: [1, 1] },
				{ idx: 2, order: 2, name: 'C', values: [2, 2] },
			],
		});
		const result = restoreFilteredSeries(data, 0);
		expect(result?.filteredSeries).toStrictEqual([{ idx: 2, order: 2, name: 'C', values: [2, 2] }]);
	});
});

describe('setDataLabelsRangeCache', () => {
	it('edits one cached label, leaving the formula untouched', () => {
		const series = chart().series[0]!;
		const withRange = {
			...series,
			dataLabelOptions: { dataLabelsRange: { formula: 'Sheet1!$D$2:$D$3', cache: ['A', 'B'] } },
		};
		const updated = setDataLabelsRangeCache(withRange, 1, 'Renamed');
		expect(updated.dataLabelOptions?.dataLabelsRange).toStrictEqual({
			formula: 'Sheet1!$D$2:$D$3',
			cache: ['A', 'Renamed'],
		});
	});

	it('pads the cache with empty strings when the index is beyond its current length', () => {
		const series = {
			...chart().series[0]!,
			dataLabelOptions: { dataLabelsRange: { formula: 'f', cache: ['A'] } },
		};
		const updated = setDataLabelsRangeCache(series, 2, 'C');
		expect(updated.dataLabelOptions?.dataLabelsRange?.cache).toStrictEqual(['A', '', 'C']);
	});

	it('returns the series unchanged when it has no dataLabelsRange', () => {
		const series = chart().series[0]!;
		expect(setDataLabelsRangeCache(series, 0, 'x')).toBe(series);
	});
});
