import { describe, expect, it } from 'vitest';

import {
	buildThemeColorSwatchGrid,
	describeThemeColorSwatch,
	themeColorVariantOfRef,
	themeColorVariantToRef,
	themeColorVariantsForLuminance,
} from './theme-color-swatches';

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

describe('theme-color-swatches', () => {
	it('picks PowerPoint variant rows by base luminance', () => {
		expect(themeColorVariantsForLuminance(0).map((v) => `${v.kind}${v.percent}`)).toStrictEqual([
			'lighter50',
			'lighter35',
			'lighter25',
			'lighter15',
			'lighter5',
		]);
		expect(themeColorVariantsForLuminance(1).map((v) => `${v.kind}${v.percent}`)).toStrictEqual([
			'darker5',
			'darker15',
			'darker25',
			'darker35',
			'darker50',
		]);
		expect(themeColorVariantsForLuminance(0.5).map((v) => `${v.kind}${v.percent}`)).toStrictEqual([
			'lighter80',
			'lighter60',
			'lighter40',
			'darker25',
			'darker50',
		]);
	});

	it('encodes lighter/darker as lumMod/lumOff and reads them back', () => {
		const lighter = themeColorVariantToRef('accent1', { kind: 'lighter', percent: 80 });
		expect(lighter).toStrictEqual({ scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 });
		const darker = themeColorVariantToRef('accent1', { kind: 'darker', percent: 25 });
		expect(darker).toStrictEqual({ scheme: 'accent1', lumMod: 0.75 });
		expect(themeColorVariantOfRef(lighter)).toStrictEqual({ kind: 'lighter', percent: 80 });
		expect(themeColorVariantOfRef(darker)).toStrictEqual({ kind: 'darker', percent: 25 });
		expect(themeColorVariantOfRef({ scheme: 'accent1' })).toBeUndefined();
		expect(themeColorVariantOfRef({ scheme: 'accent1', lumMod: 0.5, tint: 0.5 })).toBeUndefined();
	});

	it('builds the ten-column Office palette with PowerPoint hex values', () => {
		const grid = buildThemeColorSwatchGrid(OFFICE_THEME);
		expect(grid.map((c) => c.scheme)).toStrictEqual([
			'bg1',
			'tx1',
			'bg2',
			'tx2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
		]);
		const accent1 = grid[4];
		expect(accent1.base.hex).toBe('#4472c4');
		expect(accent1.base.label).toBe('Accent 1');
		// PowerPoint's own Blue, Accent 1 variants.
		expect(accent1.variants.map((s) => s.hex)).toStrictEqual([
			'#dae3f3',
			'#b4c7e7',
			'#8faadc',
			'#2f5597',
			'#203864',
		]);
		expect(accent1.variants[0].label).toBe('Accent 1, Lighter 80%');
		// White background gets the darker rows; black text gets the lighter rows.
		expect(grid[0].variants[0]).toMatchObject({ hex: '#f2f2f2', label: 'Background 1, Darker 5%' });
		expect(grid[1].variants[0]).toMatchObject({ hex: '#808080', label: 'Text 1, Lighter 50%' });
		// Light grey Background 2 (L ~0.9) gets the 10/25/50/75/90 darker rows.
		expect(grid[2].variants.map((s) => s.variant?.percent)).toStrictEqual([10, 25, 50, 75, 90]);
	});

	it('skips columns the theme map cannot resolve and tolerates a missing map', () => {
		expect(buildThemeColorSwatchGrid(undefined)).toStrictEqual([]);
		expect(buildThemeColorSwatchGrid({ accent1: '#4472C4' }).map((c) => c.scheme)).toStrictEqual([
			'accent1',
		]);
		expect(describeThemeColorSwatch({ scheme: 'hlink' }, undefined)).toBe('Hyperlink');
	});
});
