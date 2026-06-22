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
