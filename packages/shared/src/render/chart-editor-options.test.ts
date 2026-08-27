/**
 * chart-editor-options.test.ts: Vitest unit tests for chart-editor-options.ts.
 *
 * Sanity-checks the option lists and chart-type capability Sets consumed by the
 * chart inspector controls in every binding: each option carries a value and a
 * non-empty label, and the capability Sets contain the expected chart types.
 *
 * @module shared/render/chart-editor-options.test
 */

import { describe, expect, it } from 'vitest';

import { translationsEn } from '../i18n/translations-en';
import {
	CHART_TYPE_OPTIONS,
	COMBO_SERIES_TYPE_OPTIONS,
	COMBO_SUPPORTED_TYPES,
	DATA_LABEL_CONTENT_OPTIONS,
	DATA_LABEL_POSITION_OPTIONS,
	DISPLAY_UNITS_OPTIONS,
	ERROR_BAR_SUPPORTED_TYPES,
	ERROR_BAR_TYPE_OPTIONS,
	ERROR_BAR_VALTYPE_OPTIONS,
	ERROR_BAR_VALUE_TYPES,
	EXPLOSION_SUPPORTED_TYPES,
	GRIDLINE_DASH_OPTIONS,
	GROUPING_OPTIONS,
	GROUPING_SUPPORTED_TYPES,
	LEGEND_POSITION_OPTIONS,
	MARKER_SUPPORTED_TYPES,
	MARKER_SYMBOL_OPTIONS,
	patchChartData,
	TICK_LABEL_POSITION_OPTIONS,
	TRENDLINE_SUPPORTED_TYPES,
	TRENDLINE_TYPE_OPTIONS,
} from './chart-editor-options';

describe('chart-editor option lists', () => {
	const lists: Array<[string, ReadonlyArray<{ value: string; label: string }>]> = [
		['CHART_TYPE_OPTIONS', CHART_TYPE_OPTIONS],
		['GROUPING_OPTIONS', GROUPING_OPTIONS],
		['LEGEND_POSITION_OPTIONS', LEGEND_POSITION_OPTIONS],
		['TICK_LABEL_POSITION_OPTIONS', TICK_LABEL_POSITION_OPTIONS],
		['DISPLAY_UNITS_OPTIONS', DISPLAY_UNITS_OPTIONS],
		['DATA_LABEL_POSITION_OPTIONS', DATA_LABEL_POSITION_OPTIONS],
		['TRENDLINE_TYPE_OPTIONS', TRENDLINE_TYPE_OPTIONS],
		['ERROR_BAR_VALTYPE_OPTIONS', ERROR_BAR_VALTYPE_OPTIONS],
		['ERROR_BAR_TYPE_OPTIONS', ERROR_BAR_TYPE_OPTIONS],
		['MARKER_SYMBOL_OPTIONS', MARKER_SYMBOL_OPTIONS],
		['GRIDLINE_DASH_OPTIONS', GRIDLINE_DASH_OPTIONS],
		['COMBO_SERIES_TYPE_OPTIONS', COMBO_SERIES_TYPE_OPTIONS],
	];

	it.each(lists)('%s is non-empty with labelled options', (_name, list) => {
		expect(list.length).toBeGreaterThan(0);
		for (const opt of list) {
			expect(opt.value).toBeTypeOf('string');
			expect(opt.label.length).toBeGreaterThan(0);
		}
	});

	it('names every CHART_TYPE_OPTIONS entry from a key the dictionary actually defines', () => {
		const missing = CHART_TYPE_OPTIONS.filter((opt) => !(opt.labelKey in translationsEn));
		expect(missing).toStrictEqual([]);
	});

	it('offers the six ChartEx types that are creatable but were missing from every picker', () => {
		const values = CHART_TYPE_OPTIONS.map((opt) => opt.value);
		expect(values).toStrictEqual(
			expect.arrayContaining([
				'histogram',
				'funnel',
				'treemap',
				'sunburst',
				'boxWhisker',
				'regionMap',
			]),
		);
	});

	it('offers Pareto alongside Histogram, even though it is not a distinct PptxChartType', () => {
		const values = CHART_TYPE_OPTIONS.map((opt) => opt.value);
		expect(values).toContain('pareto');
		const pareto = CHART_TYPE_OPTIONS.find((opt) => opt.value === 'pareto');
		expect(pareto?.labelKey).toBe('pptx.chart.typePareto');
	});

	it('data_label_content_options pairs a content key with a label', () => {
		expect(DATA_LABEL_CONTENT_OPTIONS).toHaveLength(5);
		for (const opt of DATA_LABEL_CONTENT_OPTIONS) {
			expect(opt.key.startsWith('show')).toBeTruthy();
			expect(opt.label.length).toBeGreaterThan(0);
		}
	});
});

describe('chart-type capability sets', () => {
	it('grouping applies to cartesian types', () => {
		expect(GROUPING_SUPPORTED_TYPES.has('bar')).toBeTruthy();
		expect(GROUPING_SUPPORTED_TYPES.has('pie')).toBeFalsy();
	});

	it('markers apply to point-based types', () => {
		expect(MARKER_SUPPORTED_TYPES.has('line')).toBeTruthy();
		expect(MARKER_SUPPORTED_TYPES.has('scatter')).toBeTruthy();
		expect(MARKER_SUPPORTED_TYPES.has('bar')).toBeFalsy();
	});

	it('trendlines and error bars share the cartesian set', () => {
		for (const type of ['bar', 'line', 'area', 'scatter', 'bubble'] as const) {
			expect(TRENDLINE_SUPPORTED_TYPES.has(type)).toBeTruthy();
			expect(ERROR_BAR_SUPPORTED_TYPES.has(type)).toBeTruthy();
		}
		expect(TRENDLINE_SUPPORTED_TYPES.has('pie')).toBeFalsy();
	});

	it('explosion applies to pie-family types', () => {
		expect(EXPLOSION_SUPPORTED_TYPES.has('pie')).toBeTruthy();
		expect(EXPLOSION_SUPPORTED_TYPES.has('doughnut')).toBeTruthy();
		expect(EXPLOSION_SUPPORTED_TYPES.has('bar')).toBeFalsy();
	});

	it('combo applies to cartesian types and combo itself', () => {
		expect(COMBO_SUPPORTED_TYPES.has('bar')).toBeTruthy();
		expect(COMBO_SUPPORTED_TYPES.has('combo')).toBeTruthy();
		expect(COMBO_SUPPORTED_TYPES.has('pie')).toBeFalsy();
	});

	it('error-bar value types take a numeric amount except stdErr', () => {
		expect(ERROR_BAR_VALUE_TYPES.has('fixedVal')).toBeTruthy();
		expect(ERROR_BAR_VALUE_TYPES.has('percentage')).toBeTruthy();
		expect(ERROR_BAR_VALUE_TYPES.has('stdDev')).toBeTruthy();
		expect(ERROR_BAR_VALUE_TYPES.has('stdErr')).toBeFalsy();
	});
});

describe('patchChartData', () => {
	const bar = {
		chartType: 'bar',
		grouping: 'stacked',
		title: 'Revenue',
		categories: ['Q1', 'Q2'],
		series: [{ name: 'A', values: [1, 2] }],
	} as unknown as import('pptx-viewer-core').PptxChartData;

	it('does a plain merge for a non-type-changing patch', () => {
		const next = patchChartData(bar, { title: 'Updated' });
		expect(next.title).toBe('Updated');
		expect(next.chartType).toBe('bar');
		expect(next.grouping).toBe('stacked');
	});

	it('routes a chartType change through chartDataChangeType, clearing unsupported grouping', () => {
		const next = patchChartData(bar, { chartType: 'pie' });
		expect(next.chartType).toBe('pie');
		expect(next.grouping).toBeUndefined();
	});

	it('merges other patch fields alongside a chartType change', () => {
		const next = patchChartData(bar, { chartType: 'pie', title: 'Renamed' });
		expect(next.chartType).toBe('pie');
		expect(next.title).toBe('Renamed');
	});

	it('is a no-op type-wise when chartType matches the current type', () => {
		const next = patchChartData(bar, { chartType: 'bar', title: 'Same type' });
		expect(next.grouping).toBe('stacked');
		expect(next.title).toBe('Same type');
	});

	describe('a "pareto" chartType (docs/guide/limitations.md ChartEx row)', () => {
		it('converts to histogram, clears grouping, and appends a cumulative-percent series', () => {
			const next = patchChartData(bar, { chartType: 'pareto' });
			expect(next.chartType).toBe('histogram');
			expect(next.grouping).toBeUndefined();
			expect(next.series).toHaveLength(2);
			const [frequency, cumulative] = next.series;
			expect(frequency.values).toStrictEqual([1, 2]);
			expect(cumulative.histogramOptions?.layout).toBe('pareto');
			// Sorted descending (2, 1) before taking the running percent-of-total.
			expect(cumulative.values).toStrictEqual([66.67, 100]);
		});

		it('merges other patch fields alongside the pareto conversion', () => {
			const next = patchChartData(bar, { chartType: 'pareto', title: 'Renamed' });
			expect(next.chartType).toBe('histogram');
			expect(next.title).toBe('Renamed');
		});

		it('does not duplicate the cumulative series when already converted', () => {
			const once = patchChartData(bar, { chartType: 'pareto' });
			const twice = patchChartData(once, { chartType: 'pareto' });
			expect(twice.series).toHaveLength(2);
		});
	});
});
