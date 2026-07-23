import type { ParsedTableStyleText, PptxTableCell3D, PptxThemeFontScheme } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import type { TableCellCss } from './table-style';
import { applyStyleText, cell3DBevelCss, resolveFontRefIdx } from './table-style-fill';

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
		const css: TableCellCss = {};
		const text: ParsedTableStyleText = { fontRefIdx: 'minor' };
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
		const cell3D: PptxTableCell3D = { bevelWidth: 6, bevelHeight: 6, lightRigDirection: 'tl' };
		const css = cell3DBevelCss(cell3D);
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
