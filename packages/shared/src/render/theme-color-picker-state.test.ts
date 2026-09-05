import { describe, expect, it } from 'vitest';

import {
	customColorCommit,
	findSelectedThemeSwatch,
	themeColorRefsEqual,
	themeColorSwatchRows,
	themeSwatchCommit,
} from './theme-color-picker-state';
import { buildThemeColorSwatchGrid } from './theme-color-swatches';

const OFFICE_THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	bg1: '#FFFFFF',
	tx1: '#000000',
	bg2: '#E7E6E6',
	tx2: '#44546A',
};

describe('theme-color-picker-state', () => {
	const columns = buildThemeColorSwatchGrid(OFFICE_THEME);

	it('themeColorRefsEqual compares scheme and every transform', () => {
		expect(themeColorRefsEqual({ scheme: 'accent1' }, { scheme: 'accent1' })).toBeTruthy();
		expect(
			themeColorRefsEqual(
				{ scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 },
				{ scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 },
			),
		).toBeTruthy();
		expect(themeColorRefsEqual({ scheme: 'accent1' }, { scheme: 'accent2' })).toBeFalsy();
		expect(
			themeColorRefsEqual({ scheme: 'accent1', lumMod: 0.2 }, { scheme: 'accent1' }),
		).toBeFalsy();
		expect(themeColorRefsEqual(undefined, undefined)).toBeTruthy();
		expect(themeColorRefsEqual({ scheme: 'accent1' }, undefined)).toBeFalsy();
	});

	it('finds the exact swatch by ref, ignoring hex', () => {
		const ref = { scheme: 'accent1' as const, lumMod: 0.2, lumOff: 0.8 };
		const found = findSelectedThemeSwatch(columns, ref, '#000000');
		expect(found?.ref).toStrictEqual(ref);
		expect(found?.label).toBe('Accent 1, Lighter 80%');
	});

	it('falls back to matching by resolved hex (case-insensitive) when no ref is given', () => {
		const found = findSelectedThemeSwatch(columns, undefined, '#4472c4');
		expect(found?.ref).toStrictEqual({ scheme: 'accent1' });
	});

	it('returns undefined when neither the ref nor the hex resolves to a swatch', () => {
		expect(findSelectedThemeSwatch(columns, undefined, '#123456')).toBeUndefined();
		expect(findSelectedThemeSwatch(columns, undefined, undefined)).toBeUndefined();
		expect(
			findSelectedThemeSwatch(columns, { scheme: 'accent1', shade: 0.5 }, undefined),
		).toBeUndefined();
	});

	it('a theme swatch commits both its hex and its ref', () => {
		const base = columns.find((c) => c.scheme === 'accent1')?.base;
		expect(base).toBeDefined();
		if (base) {
			expect(themeSwatchCommit(base)).toStrictEqual({ hex: base.hex, ref: base.ref });
		}
	});

	it('a custom colour commit always clears the ref', () => {
		expect(customColorCommit('#abcdef')).toStrictEqual({ hex: '#abcdef', ref: undefined });
	});

	it('lays swatches out as base row + one row per variant index, aligned by column', () => {
		const rows = themeColorSwatchRows(columns);
		expect(rows).toHaveLength(6);
		expect(rows[0]?.every((swatch) => swatch?.variant === undefined)).toBeTruthy();
		expect(rows[0]?.map((swatch) => swatch?.ref.scheme)).toStrictEqual(
			columns.map((c) => c.scheme),
		);
		for (let i = 1; i < rows.length; i++) {
			for (let col = 0; col < columns.length; col++) {
				expect(rows[i]?.[col]).toStrictEqual(columns[col]?.variants[i - 1]);
			}
		}
	});

	it('returns no rows for an empty column list', () => {
		expect(themeColorSwatchRows([])).toStrictEqual([]);
	});
});
