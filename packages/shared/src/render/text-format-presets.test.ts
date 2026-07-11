import { describe, expect, it } from 'vitest';

import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_FAMILIES,
	COMMON_FONT_SIZES,
	LINE_SPACING_OPTIONS,
} from './text-format-presets';

describe('font preset lists', () => {
	it('offers the classic office font families', () => {
		expect(COMMON_FONT_FAMILIES).toContain('Arial');
		expect(COMMON_FONT_FAMILIES).toContain('Segoe UI');
		expect(COMMON_FONT_FAMILIES).toHaveLength(13);
	});

	it('offers the standard size ramp in ascending order', () => {
		expect(COMMON_FONT_SIZES[0]).toBe(8);
		expect(COMMON_FONT_SIZES[COMMON_FONT_SIZES.length - 1]).toBe(96);
		const sorted = [...COMMON_FONT_SIZES].sort((a, b) => a - b);
		expect([...COMMON_FONT_SIZES]).toStrictEqual(sorted);
	});
});

describe('spacing preset lists', () => {
	it('spans very tight to very loose character spacing', () => {
		expect(CHARACTER_SPACING_OPTIONS.map((o) => o.value)).toStrictEqual([-150, -75, 0, 75, 150]);
	});

	it('offers the standard line-spacing multipliers', () => {
		expect(LINE_SPACING_OPTIONS.map((o) => o.value)).toStrictEqual([1.0, 1.15, 1.5, 2.0, 2.5, 3.0]);
	});
});

describe('change case options', () => {
	it('lists all five modes in menu order', () => {
		expect(CHANGE_CASE_OPTIONS.map((o) => o.value)).toStrictEqual([
			'sentence',
			'lower',
			'upper',
			'capitalize',
			'toggle',
		]);
	});

	it('gives every option a shared-i18n key', () => {
		for (const option of CHANGE_CASE_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.text\.changeCase/);
		}
	});
});
