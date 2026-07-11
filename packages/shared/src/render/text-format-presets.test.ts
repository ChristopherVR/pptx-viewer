import { describe, expect, it } from 'vitest';

import {
	CHANGE_CASE_OPTIONS,
	changeCaseStyleUpdate,
	CHARACTER_SPACING_OPTIONS,
	COMMON_FONT_FAMILIES,
	COMMON_FONT_SIZES,
	LINE_SPACING_OPTIONS,
	transformTextCase,
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

describe('changeCaseStyleUpdate', () => {
	it('maps upper to textCaps all', () => {
		expect(changeCaseStyleUpdate('upper')).toStrictEqual({ textCaps: 'all' });
	});

	it('clears the caps override for every other mode', () => {
		expect(changeCaseStyleUpdate('lower')).toStrictEqual({ textCaps: 'none' });
		expect(changeCaseStyleUpdate('sentence')).toStrictEqual({ textCaps: 'none' });
		expect(changeCaseStyleUpdate('capitalize')).toStrictEqual({ textCaps: 'none' });
		expect(changeCaseStyleUpdate('toggle')).toStrictEqual({ textCaps: 'none' });
	});

	it('lists all five modes in menu order', () => {
		expect(CHANGE_CASE_OPTIONS.map((o) => o.value)).toStrictEqual([
			'sentence',
			'lower',
			'upper',
			'capitalize',
			'toggle',
		]);
	});
});

describe('transformTextCase', () => {
	it('uppercases and lowercases the whole string', () => {
		expect(transformTextCase('Hello World', 'upper')).toBe('HELLO WORLD');
		expect(transformTextCase('Hello World', 'lower')).toBe('hello world');
	});

	it('capitalizes each word', () => {
		expect(transformTextCase('hello WORLD again', 'capitalize')).toBe('Hello World Again');
	});

	it('applies sentence case across sentence boundaries', () => {
		expect(transformTextCase('hello world. GOODBYE moon! ok? yes', 'sentence')).toBe(
			'Hello world. Goodbye moon! Ok? Yes',
		);
	});

	it('toggles case per character, passing non-letters through', () => {
		expect(transformTextCase('Hello, World 42!', 'toggle')).toBe('hELLO, wORLD 42!');
	});

	it('handles empty strings', () => {
		expect(transformTextCase('', 'sentence')).toBe('');
		expect(transformTextCase('', 'toggle')).toBe('');
	});
});
