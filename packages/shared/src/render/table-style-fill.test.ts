import type {
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxTableCell3D,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
} from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import type { TableCellCss } from './table-style';
import {
	applyStyleFill,
	applyStyleText,
	cell3DBevelCss,
	resolveFontRefIdx,
	resolveStyleFillColor,
} from './table-style-fill';

describe('resolveStyleFillColor - tint/shade (ECMA-376 20.1.2.3.32)', () => {
	it('tint=100000 (100%) leaves an explicit colour unchanged', () => {
		const fill: ParsedTableStyleFill = { schemeColor: '', color: '#AABBCC', tint: 100_000 };
		expect(resolveStyleFillColor(fill, undefined)).toBe('#AABBCC');
	});

	it('a low tint value mixes mostly toward white', () => {
		const fill: ParsedTableStyleFill = { schemeColor: '', color: '#000000', tint: 20_000 };
		// 20% tint = 20% input + 80% white: 255 - 255*0.2 = 204 = 0xCC
		expect(resolveStyleFillColor(fill, undefined)).toBe('#CCCCCC');
	});

	it('shade=100000 (100%) leaves an explicit colour unchanged', () => {
		const fill: ParsedTableStyleFill = { schemeColor: '', color: '#AABBCC', shade: 100_000 };
		expect(resolveStyleFillColor(fill, undefined)).toBe('#AABBCC');
	});
});

describe('resolveFontRefIdx', () => {
	const fontScheme: PptxThemeFontScheme = {
		majorFont: { latin: 'Calibri Light' },
		minorFont: { latin: 'Calibri' },
	};

	it('resolves minor to the body font', () => {
		expect(resolveFontRefIdx('minor', fontScheme)).toBe('Calibri');
	});

	it('resolves major to the heading font', () => {
		expect(resolveFontRefIdx('major', fontScheme)).toBe('Calibri Light');
	});

	it('returns undefined for none, missing idx, or missing scheme', () => {
		expect(resolveFontRefIdx('none', fontScheme)).toBeUndefined();
		expect(resolveFontRefIdx(undefined, fontScheme)).toBeUndefined();
		expect(resolveFontRefIdx('minor', undefined)).toBeUndefined();
	});
});

describe('applyStyleText - fontRef idx (issue: tcTxStyle a:fontRef@idx)', () => {
	const fontScheme: PptxThemeFontScheme = {
		majorFont: { latin: 'Georgia' },
		minorFont: { latin: 'Verdana' },
	};

	it('applies the theme minor font from fontRefIdx', () => {
		const css: TableCellCss = {},
			text: ParsedTableStyleText = { fontRefIdx: 'minor' };
		expect(applyStyleText(text, undefined, css, fontScheme)).toBeTruthy();
		expect(css.fontFamily).toBe('Verdana');
	});

	it('applies the theme major font from fontRefIdx', () => {
		const css: TableCellCss = {};
		applyStyleText({ fontRefIdx: 'major' }, undefined, css, fontScheme);
		expect(css.fontFamily).toBe('Georgia');
	});

	it('lets an explicit fontFace win over fontRefIdx', () => {
		const css: TableCellCss = {};
		applyStyleText({ fontFace: 'Arial', fontRefIdx: 'minor' }, undefined, css, fontScheme);
		expect(css.fontFamily).toBe('Arial');
	});

	it('does not resolve fontRefIdx without a font scheme', () => {
		const css: TableCellCss = {};
		expect(applyStyleText({ fontRefIdx: 'minor' }, undefined, css)).toBeFalsy();
		expect(css.fontFamily).toBeUndefined();
	});
});

describe('cell3DBevelCss', () => {
	it('builds a paired inset box-shadow bevel', () => {
		const cell3D: PptxTableCell3D = { bevelWidth: 6, bevelHeight: 6, lightRigDirection: 'tl' },
			css = cell3DBevelCss(cell3D);
		expect(String(css.boxShadow)).toContain('inset 6px 6px');
		expect(String(css.boxShadow)).toContain('inset -6px -6px');
	});

	it('flips the highlight for a bottom-right light rig', () => {
		const css = cell3DBevelCss({ bevelHeight: 4, lightRigDirection: 'br' });
		// br => highlight offset (-1,-1), shadow (+1,+1)
		expect(String(css.boxShadow)).toContain('inset -4px -4px');
		expect(String(css.boxShadow)).toContain('inset 4px 4px');
	});

	it('defaults the bevel size and direction when unset', () => {
		const css = cell3DBevelCss({});
		// Default size 4, default direction tl.
		expect(String(css.boxShadow)).toContain('inset 4px 4px');
	});
});

const colorScheme: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#FF0000',
	accent2: '#00FF00',
	accent3: '#a5a5a5',
	accent4: '#ffc000',
	accent5: '#5b9bd5',
	accent6: '#70ad47',
	hlink: '#0563c1',
	folHlink: '#954f72',
};

describe('applyStyleFill - a:alpha (built-in "Light Style 1/3" and "Themed Style 1/2" bands)', () => {
	it('converts an alpha-carrying scheme fill to a see-through rgba(), not an opaque hex', () => {
		// Real PowerPoint bands these built-in styles with a partially
		// transparent tint of the theme colour (`<a:schemeClr val="accent1">
		// <a:alpha val="20000"/></a:schemeClr>`), which core previously parsed
		// but silently dropped (table-style-fill-parse.ts handled only
		// tint/shade), so the band rendered fully opaque.
		const fill: ParsedTableStyleFill = { schemeColor: 'accent1', alpha: 20_000 };
		const css: TableCellCss = {};
		const applied = applyStyleFill(fill, colorScheme, css);
		expect(applied).toBeTruthy();
		expect(css.backgroundColor).toBe('rgba(255, 0, 0, 0.2)');
	});

	it('renders full opacity when alpha is absent, matching a plain tint/shade fill', () => {
		const fill: ParsedTableStyleFill = { schemeColor: 'accent1' };
		const css: TableCellCss = {};
		applyStyleFill(fill, colorScheme, css);
		expect(css.backgroundColor).toBe('#FF0000');
	});

	it('applies alpha=40000 (Themed Style 1) as 40% opacity', () => {
		const fill: ParsedTableStyleFill = { schemeColor: 'accent1', alpha: 40_000 };
		const css: TableCellCss = {};
		applyStyleFill(fill, colorScheme, css);
		expect(css.backgroundColor).toBe('rgba(255, 0, 0, 0.4)');
	});
});
