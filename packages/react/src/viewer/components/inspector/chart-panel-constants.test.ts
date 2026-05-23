import type { PptxChartType } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	HEADING,
	CARD,
	INPUT,
	BTN,
	CELL_INPUT,
	CHART_TYPE_OPTIONS,
	GROUPING_OPTIONS,
	LEGEND_POSITION_OPTIONS,
	GROUPING_SUPPORTED_TYPES,
} from './chart-panel-constants';

// ---------------------------------------------------------------------------
// CSS class strings
// ---------------------------------------------------------------------------

describe('cSS class strings', () => {
	it('hEADING is a non-empty string', () => {
		expect(HEADING).toBeTruthy();
		expectTypeOf(HEADING).toBeString();
	});

	it('cARD is a non-empty string', () => {
		expect(CARD).toBeTruthy();
		expectTypeOf(CARD).toBeString();
	});

	it('iNPUT is a non-empty string', () => {
		expect(INPUT).toBeTruthy();
		expectTypeOf(INPUT).toBeString();
	});

	it('bTN is a non-empty string', () => {
		expect(BTN).toBeTruthy();
		expectTypeOf(BTN).toBeString();
	});

	it('cELL_INPUT is a non-empty string', () => {
		expect(CELL_INPUT).toBeTruthy();
		expectTypeOf(CELL_INPUT).toBeString();
	});
});

// ---------------------------------------------------------------------------
// CHART_TYPE_OPTIONS
// ---------------------------------------------------------------------------

describe('cHART_TYPE_OPTIONS', () => {
	it('has 11 chart types', () => {
		expect(CHART_TYPE_OPTIONS).toHaveLength(11);
	});

	it('contains bar, line, pie', () => {
		const values = CHART_TYPE_OPTIONS.map((o) => o.value);
		expect(values).toContain('bar');
		expect(values).toContain('line');
		expect(values).toContain('pie');
	});

	it('contains scatter, bubble, radar', () => {
		const values = CHART_TYPE_OPTIONS.map((o) => o.value);
		expect(values).toContain('scatter');
		expect(values).toContain('bubble');
		expect(values).toContain('radar');
	});

	it('every item has a non-empty value and labelKey', () => {
		for (const opt of CHART_TYPE_OPTIONS) {
			expect(opt.value).toBeTruthy();
			expect(opt.labelKey).toBeTruthy();
			expectTypeOf(opt.labelKey).toBeString();
		}
	});

	it('has no duplicate values', () => {
		const values = CHART_TYPE_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
	});
});

// ---------------------------------------------------------------------------
// GROUPING_OPTIONS
// ---------------------------------------------------------------------------

describe('gROUPING_OPTIONS', () => {
	it('has exactly 3 options', () => {
		expect(GROUPING_OPTIONS).toHaveLength(3);
	});

	it('contains clustered, stacked, percentStacked', () => {
		const values = GROUPING_OPTIONS.map((o) => o.value);
		expect(values).toContain('clustered');
		expect(values).toContain('stacked');
		expect(values).toContain('percentStacked');
	});

	it('every item has a non-empty labelKey', () => {
		for (const opt of GROUPING_OPTIONS) {
			expect(opt.labelKey).toBeTruthy();
		}
	});

	it('has no duplicate values', () => {
		const values = GROUPING_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
	});
});

// ---------------------------------------------------------------------------
// LEGEND_POSITION_OPTIONS
// ---------------------------------------------------------------------------

describe('lEGEND_POSITION_OPTIONS', () => {
	it('has exactly 4 positions', () => {
		expect(LEGEND_POSITION_OPTIONS).toHaveLength(4);
	});

	it('contains t, b, l, r', () => {
		const values = LEGEND_POSITION_OPTIONS.map((o) => o.value);
		expect(values).toContain('t');
		expect(values).toContain('b');
		expect(values).toContain('l');
		expect(values).toContain('r');
	});

	it('every item has a non-empty labelKey', () => {
		for (const opt of LEGEND_POSITION_OPTIONS) {
			expect(opt.labelKey).toBeTruthy();
		}
	});

	it('has no duplicate values', () => {
		const values = LEGEND_POSITION_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
	});
});

// ---------------------------------------------------------------------------
// GROUPING_SUPPORTED_TYPES
// ---------------------------------------------------------------------------

describe('gROUPING_SUPPORTED_TYPES', () => {
	it('is a Set', () => {
		expect(GROUPING_SUPPORTED_TYPES).toBeInstanceOf(Set);
	});

	it('contains bar, line, area', () => {
		expect(GROUPING_SUPPORTED_TYPES.has('bar')).toBeTruthy();
		expect(GROUPING_SUPPORTED_TYPES.has('line')).toBeTruthy();
		expect(GROUPING_SUPPORTED_TYPES.has('area')).toBeTruthy();
	});

	it('does not contain pie or scatter', () => {
		expect(GROUPING_SUPPORTED_TYPES.has('pie' as PptxChartType)).toBeFalsy();
		expect(GROUPING_SUPPORTED_TYPES.has('scatter' as PptxChartType)).toBeFalsy();
	});

	it('has exactly 3 entries', () => {
		expect(GROUPING_SUPPORTED_TYPES.size).toBe(3);
	});
});
