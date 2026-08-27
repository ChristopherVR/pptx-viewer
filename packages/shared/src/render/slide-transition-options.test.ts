import { describe, expect, it } from 'vitest';

import {
	buildDirectionGrid,
	SLIDE_TRANSITION_OPTIONS,
	TRANSITION_DIR_ARROWS,
	TRANSITION_MORPH_OPTIONS,
	TRANSITION_ORIENTATION_TYPES,
	TRANSITION_SPEED_OPTIONS,
} from './slide-transition-options';

describe('sLIDE_TRANSITION_OPTIONS', () => {
	it('starts at "none" and carries a dictionary key on every entry', () => {
		expect(SLIDE_TRANSITION_OPTIONS[0].value).toBe('none');
		for (const option of SLIDE_TRANSITION_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\./);
			expect(option.label.length).toBeGreaterThan(0);
		}
	});

	it('lists every value exactly once', () => {
		const values = SLIDE_TRANSITION_OPTIONS.map((option) => option.value);
		expect(new Set(values).size).toBe(values.length);
	});

	it('includes the modern types the inspector must offer', () => {
		const values = SLIDE_TRANSITION_OPTIONS.map((option) => option.value);
		expect(values).toContain('morph');
		expect(values).toContain('newsflash');
	});
});

describe('tRANSITION_ORIENTATION_TYPES', () => {
	it('covers exactly the horz/vert transition family', () => {
		expect([...TRANSITION_ORIENTATION_TYPES].sort()).toStrictEqual([
			'blinds',
			'checker',
			'comb',
			'randomBar',
		]);
	});
});

describe('tRANSITION_SPEED_OPTIONS', () => {
	it('lists slow/med/fast with a dictionary key each', () => {
		expect(TRANSITION_SPEED_OPTIONS.map((option) => option.value)).toStrictEqual([
			'slow',
			'med',
			'fast',
		]);
		for (const option of TRANSITION_SPEED_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.transition\.speed\./);
		}
	});
});

describe('tRANSITION_MORPH_OPTIONS', () => {
	it('lists byObject/byWord/byChar with a dictionary key each', () => {
		expect(TRANSITION_MORPH_OPTIONS.map((option) => option.value)).toStrictEqual([
			'byObject',
			'byWord',
			'byChar',
		]);
		for (const option of TRANSITION_MORPH_OPTIONS) {
			expect(option.i18nKey).toMatch(/^pptx\.transition\.morphOption\./);
		}
	});
});

describe('buildDirectionGrid', () => {
	it('places the eight directions in their compass slots', () => {
		const grid = buildDirectionGrid(['lu', 'u', 'ru', 'l', 'r', 'ld', 'd', 'rd']);
		expect(grid).toStrictEqual([
			['lu', 'u', 'ru'],
			['l', null, 'r'],
			['ld', 'd', 'rd'],
		]);
	});

	it('leaves unrepresented slots empty and drops non-grid tokens', () => {
		const grid = buildDirectionGrid(['l', 'r', 'in', 'out']);
		expect(grid[1]).toStrictEqual(['l', null, 'r']);
		expect(grid.flat().filter(Boolean)).toStrictEqual(['l', 'r']);
	});

	it('has an arrow glyph for every grid token', () => {
		for (const token of ['l', 'r', 'u', 'd', 'lu', 'ld', 'ru', 'rd']) {
			expect(TRANSITION_DIR_ARROWS[token]).toBeTruthy();
		}
	});
});
