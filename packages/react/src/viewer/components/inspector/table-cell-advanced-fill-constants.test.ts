import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	SEL,
	NUM,
	LBL,
	SECTION_HEADING,
	FILL_MODE_OPTIONS,
	GRADIENT_TYPE_OPTIONS,
	PATTERN_OPTIONS,
} from './table-cell-advanced-fill-constants';

describe('table-cell-advanced-fill-constants', () => {
	describe('cSS class tokens', () => {
		it('sEL is a non-empty string', () => {
			expectTypeOf(SEL).toBeString();
			expect(SEL.length).toBeGreaterThan(0);
		});

		it('nUM is a non-empty string', () => {
			expectTypeOf(NUM).toBeString();
			expect(NUM.length).toBeGreaterThan(0);
		});

		it('lBL is a non-empty string', () => {
			expectTypeOf(LBL).toBeString();
			expect(LBL.length).toBeGreaterThan(0);
		});

		it('sECTION_HEADING is a non-empty string', () => {
			expectTypeOf(SECTION_HEADING).toBeString();
			expect(SECTION_HEADING.length).toBeGreaterThan(0);
		});
	});

	describe('fILL_MODE_OPTIONS', () => {
		it('is a non-empty array', () => {
			expect(Array.isArray(FILL_MODE_OPTIONS)).toBeTruthy();
			expect(FILL_MODE_OPTIONS.length).toBeGreaterThan(0);
		});

		it('has no duplicate values', () => {
			const values = FILL_MODE_OPTIONS.map((o) => o.value);
			expect(new Set(values).size).toBe(values.length);
		});

		it('has no duplicate i18nKeys', () => {
			const keys = FILL_MODE_OPTIONS.map((o) => o.i18nKey);
			expect(new Set(keys).size).toBe(keys.length);
		});

		it('every entry has value and i18nKey', () => {
			for (const opt of FILL_MODE_OPTIONS) {
				expectTypeOf(opt.value).toBeString();
				expect(opt.value.length).toBeGreaterThan(0);
				expectTypeOf(opt.i18nKey).toBeString();
				expect(opt.i18nKey.length).toBeGreaterThan(0);
			}
		});

		it('contains expected fill modes', () => {
			const values = FILL_MODE_OPTIONS.map((o) => o.value);
			expect(values).toContain('solid');
			expect(values).toContain('gradient');
			expect(values).toContain('pattern');
			expect(values).toContain('none');
		});
	});

	describe('gRADIENT_TYPE_OPTIONS', () => {
		it('is a non-empty array', () => {
			expect(Array.isArray(GRADIENT_TYPE_OPTIONS)).toBeTruthy();
			expect(GRADIENT_TYPE_OPTIONS.length).toBeGreaterThan(0);
		});

		it('has no duplicate values', () => {
			const values = GRADIENT_TYPE_OPTIONS.map((o) => o.value);
			expect(new Set(values).size).toBe(values.length);
		});

		it('contains linear and radial', () => {
			const values = GRADIENT_TYPE_OPTIONS.map((o) => o.value);
			expect(values).toContain('linear');
			expect(values).toContain('radial');
		});

		it('every entry has value and i18nKey', () => {
			for (const opt of GRADIENT_TYPE_OPTIONS) {
				expectTypeOf(opt.value).toBeString();
				expectTypeOf(opt.i18nKey).toBeString();
			}
		});
	});

	describe('pATTERN_OPTIONS', () => {
		it('is an array with at most 20 items', () => {
			expect(Array.isArray(PATTERN_OPTIONS)).toBeTruthy();
			expect(PATTERN_OPTIONS.length).toBeLessThanOrEqual(20);
		});

		it('is non-empty', () => {
			expect(PATTERN_OPTIONS.length).toBeGreaterThan(0);
		});
	});
});
