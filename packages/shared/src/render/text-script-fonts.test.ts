import { getSubstituteFontFamily } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveScriptFontSet, splitRunByScriptFont } from './text-script-fonts';
import type { ScriptFontSet } from './text-script-fonts';

describe('resolveScriptFontSet', () => {
	it("falls back every script to the run's own latin face when none is authored", () => {
		const fonts = resolveScriptFontSet(undefined, undefined, 'Arial');
		expect(fonts).toStrictEqual({
			latin: 'Arial',
			eastAsia: 'Arial',
			complexScript: 'Arial',
			symbol: 'Arial',
		});
	});

	it('substitutes a run-authored east-Asian font', () => {
		const fonts = resolveScriptFontSet({ eastAsiaFont: 'SimSun' }, undefined, 'Arial');
		expect(fonts.eastAsia).not.toBe('Arial');
		expect(fonts.latin).toBe('Arial');
	});

	it("falls back to the body's script font when the run authors none", () => {
		const fonts = resolveScriptFontSet(
			undefined,
			{ complexScriptFont: 'Traditional Arabic' },
			'Arial',
		);
		expect(fonts.complexScript).not.toBe('Arial');
	});

	it("prefers the run's own script font over the body's", () => {
		const runOwn = resolveScriptFontSet(
			{ symbolFont: 'Wingdings' },
			{ symbolFont: 'Webdings' },
			'Arial',
		);
		const bodyOnly = resolveScriptFontSet(undefined, { symbolFont: 'Webdings' }, 'Arial');
		expect(runOwn.symbol).not.toBe(bodyOnly.symbol);
		expect(runOwn.symbol).toBe(getSubstituteFontFamily('Wingdings'));
	});

	it('substitutes an authored east-Asian name the SAME way the latin base was, so an identical typeface compares equal', () => {
		// issue #132: comparing a bare `a:ea` name against the already-substituted
		// `a:latin` chain made an identical typeface look distinct, which both
		// emitted a needless nested span AND let that span's raw name win over the
		// fallback chain the parent had carefully built.
		const baseFontFamily = getSubstituteFontFamily('Calibri');
		const fonts = resolveScriptFontSet({ eastAsiaFont: 'Calibri' }, undefined, baseFontFamily);
		expect(fonts.eastAsia).toBe(baseFontFamily);
	});
});

describe('splitRunByScriptFont', () => {
	const sameFonts: ScriptFontSet = {
		latin: 'Arial',
		eastAsia: 'Arial',
		complexScript: 'Arial',
		symbol: 'Arial',
	};
	const mixedFonts: ScriptFontSet = {
		latin: 'Arial',
		eastAsia: 'SimSun',
		complexScript: 'Arial',
		symbol: 'Arial',
	};

	it('returns undefined when no script names a distinct font', () => {
		expect(splitRunByScriptFont('Hello world', sameFonts, 'Arial')).toBeUndefined();
	});

	it('returns undefined for pure-latin text even when other scripts differ', () => {
		expect(splitRunByScriptFont('Hello world', mixedFonts, 'Arial')).toBeUndefined();
	});

	it('wraps the whole run when it is entirely one non-latin script', () => {
		const pieces = splitRunByScriptFont('中文文本', mixedFonts, 'Arial');
		expect(pieces).toHaveLength(1);
		expect(pieces?.[0].text).toBe('中文文本');
		expect(pieces?.[0].style?.fontFamily).toBe('SimSun');
	});

	it('splits mixed latin/CJK text into per-script pieces', () => {
		const pieces = splitRunByScriptFont('Mixed 中文 text', mixedFonts, 'Arial');
		expect(pieces).toBeDefined();
		expect(pieces?.length ?? 0).toBeGreaterThan(1);
		const cjkPiece = pieces?.find((p) => p.text.includes('中'));
		expect(cjkPiece?.style?.fontFamily).toBe('SimSun');
		const latinPiece = pieces?.find((p) => p.text.startsWith('Mixed'));
		// The latin piece renders in the run's own face, so it needs no span at all.
		expect(latinPiece?.style).toBeUndefined();
	});

	it('splits Arabic text under a distinct complex-script font', () => {
		const fonts: ScriptFontSet = {
			latin: 'Arial',
			eastAsia: 'Arial',
			complexScript: 'Traditional Arabic',
			symbol: 'Arial',
		};
		const pieces = splitRunByScriptFont('Hello مرحبا', fonts, 'Arial');
		expect(pieces).toBeDefined();
		const arabicPiece = pieces?.find((p) => /[؀-ۿ]/u.test(p.text));
		expect(arabicPiece?.style?.fontFamily).toBe('Traditional Arabic');
	});

	it("repeats the run's decoration onto a piece that gets its own span", () => {
		const pieces = splitRunByScriptFont('中文', mixedFonts, 'Arial', {
			textDecoration: 'underline',
		});
		expect(pieces?.[0].style?.textDecoration).toBe('underline');
	});

	it('returns undefined for empty text', () => {
		expect(splitRunByScriptFont('', mixedFonts, 'Arial')).toBeUndefined();
	});
});
