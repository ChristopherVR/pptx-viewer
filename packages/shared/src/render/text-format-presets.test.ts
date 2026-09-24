import { describe, expect, it } from 'vitest';

import {
	CHANGE_CASE_OPTIONS,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_FAMILIES,
	COMMON_FONT_SIZES,
	LINE_SPACING_OPTIONS,
	stepFontSizePt,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from './text-format-presets';

describe('font preset lists', () => {
	it('offers the classic office font families', () => {
		expect(COMMON_FONT_FAMILIES).toContain('Arial');
		expect(COMMON_FONT_FAMILIES).toContain('Segoe UI');
		// Aptos replaced Calibri as the default Office theme font, so both must
		// be offered for decks authored either side of that change.
		expect(COMMON_FONT_FAMILIES).toContain('Aptos');
		expect(COMMON_FONT_FAMILIES).toContain('Calibri');
	});

	it('lists font families alphabetically and without duplicates', () => {
		const sorted = [...COMMON_FONT_FAMILIES].sort((a, b) => a.localeCompare(b));
		expect([...COMMON_FONT_FAMILIES]).toStrictEqual(sorted);
		expect(new Set(COMMON_FONT_FAMILIES).size).toBe(COMMON_FONT_FAMILIES.length);
	});

	it('offers the standard size ramp in ascending order', () => {
		expect(COMMON_FONT_SIZES[0]).toBe(8);
		expect(COMMON_FONT_SIZES[COMMON_FONT_SIZES.length - 1]).toBe(96);
		const sorted = [...COMMON_FONT_SIZES].sort((a, b) => a - b);
		expect([...COMMON_FONT_SIZES]).toStrictEqual(sorted);
	});

	it('converts regular-text font sizes between model pixels and control points', () => {
		expect(textFontSizePxToPt(64)).toBe(48);
		expect(textFontSizePxToPt(48.1 * (96 / 72))).toBe(48.1);
		expect(textFontSizePtToPx(10.5)).toBeCloseTo(14);
	});
});

describe('stepFontSizePt', () => {
	it('moves to the next larger rung on the ladder', () => {
		expect(stepFontSizePt(11, 'increase')).toBe(12);
		expect(stepFontSizePt(12, 'increase')).toBe(14);
	});

	it('moves to the next smaller rung on the ladder', () => {
		expect(stepFontSizePt(14, 'decrease')).toBe(12);
		expect(stepFontSizePt(12, 'decrease')).toBe(11);
	});

	it('rounds a size between two rungs to the nearest rung in the requested direction', () => {
		expect(stepFontSizePt(13, 'increase')).toBe(14);
		expect(stepFontSizePt(13, 'decrease')).toBe(12);
	});

	it('clamps at the top of the ladder instead of growing past it', () => {
		expect(stepFontSizePt(96, 'increase')).toBe(96);
		expect(stepFontSizePt(120, 'increase')).toBe(96);
	});

	it('clamps at the bottom of the ladder instead of shrinking past it', () => {
		expect(stepFontSizePt(8, 'decrease')).toBe(8);
		expect(stepFontSizePt(2, 'decrease')).toBe(8);
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
