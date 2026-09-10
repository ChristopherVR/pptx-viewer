import { describe, it, expect } from 'vitest';

import { TABLE as APTOS_TABLE } from './font-advance-widths-aptos.generated';
import { TABLE as ARIAL_TABLE } from './font-advance-widths-arial.generated';
import { TABLE as CALIBRI_LIGHT_TABLE } from './font-advance-widths-calibri-light.generated';
import { TABLE as CALIBRI_TABLE } from './font-advance-widths-calibri.generated';
import { TABLE as SEGOE_UI_TABLE } from './font-advance-widths-segoe-ui.generated';
import { TABLE as TIMES_NEW_ROMAN_TABLE } from './font-advance-widths-times-new-roman.generated';
import type { FontAdvanceTable } from './font-advance-widths.generated';
import {
	FONT_SUBSTITUTION_MAP,
	PANOSE_FAMILY_MAP,
	PANOSE_SANS_SERIF_STYLES,
	PANOSE_MONOSPACE_PROPORTION,
	PANOSE_WEIGHT_MAP,
	parsePanoseString,
	parsePanoseBytes,
	classifyPanose,
	getPanoseWeight,
	getSubstituteFontFamily,
	getSubstituteFonts,
	hasDirectSubstitution,
	buildFontFamilyString,
	stripFontStyleSuffix,
} from './font-substitution';

// ---------------------------------------------------------------------------
// parsePanoseString
// ---------------------------------------------------------------------------

describe('parsePanoseString', () => {
	it('parses a valid 20-character hex PANOSE string', () => {
		// Arial: 020B0604020202020204
		const result = parsePanoseString('020B0604020202020204');
		expect(result).toStrictEqual([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
	});

	it('parses lowercase hex digits', () => {
		const result = parsePanoseString('020b0604020202020204');
		expect(result).toStrictEqual([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
	});

	it('returns undefined for an empty string', () => {
		expect(parsePanoseString('')).toBeUndefined();
	});

	it('returns undefined for null / undefined', () => {
		expect(parsePanoseString(null)).toBeUndefined();
		expect(parsePanoseString(undefined)).toBeUndefined();
	});

	it('returns undefined for a string that is too short', () => {
		expect(parsePanoseString('020B0604')).toBeUndefined();
	});

	it('returns undefined for a string that is too long', () => {
		expect(parsePanoseString('020B060402020202020400')).toBeUndefined();
	});

	it('returns undefined for non-hex characters', () => {
		expect(parsePanoseString('020B0604020202020XYZ')).toBeUndefined();
	});

	it('trims whitespace before parsing', () => {
		const result = parsePanoseString('  020B0604020202020204  ');
		expect(result).toStrictEqual([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
	});
});

// ---------------------------------------------------------------------------
// parsePanoseBytes
// ---------------------------------------------------------------------------

describe('parsePanoseBytes', () => {
	it('converts a 10-byte Uint8Array to a number array', () => {
		const data = new Uint8Array([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
		const result = parsePanoseBytes(data);
		expect(result).toStrictEqual([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
	});

	it('accepts a regular number array of length 10', () => {
		const data = [2, 11, 6, 4, 2, 2, 2, 2, 2, 4];
		const result = parsePanoseBytes(data);
		expect(result).toStrictEqual([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
	});

	it('returns undefined for arrays shorter than 10', () => {
		expect(parsePanoseBytes(new Uint8Array([1, 2, 3]))).toBeUndefined();
	});

	it('returns undefined for arrays longer than 10', () => {
		expect(parsePanoseBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toBeUndefined();
	});

	it('returns undefined for null / undefined', () => {
		expect(parsePanoseBytes(null)).toBeUndefined();
		expect(parsePanoseBytes(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// classifyPanose
// ---------------------------------------------------------------------------

describe('classifyPanose', () => {
	it('classifies Latin Text with serif style as serif', () => {
		// bFamilyType=2 (Latin Text), bSerifStyle=2 (Cove), bWeight=5, bProportion=2
		const result = classifyPanose([2, 2, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('serif');
	});

	it('classifies Latin Text with sans-serif style as sans-serif', () => {
		// bFamilyType=2, bSerifStyle=11 (Normal Sans), bWeight=6, bProportion=4
		const result = classifyPanose([2, 11, 6, 4, 2, 2, 2, 2, 2, 4]);
		expect(result).toBe('sans-serif');
	});

	it('classifies Latin Hand Written as cursive', () => {
		// bFamilyType=3
		const result = classifyPanose([3, 0, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('cursive');
	});

	it('classifies Latin Decorative as fantasy', () => {
		// bFamilyType=4
		const result = classifyPanose([4, 0, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('fantasy');
	});

	it('classifies Latin Symbol as sans-serif', () => {
		// bFamilyType=5
		const result = classifyPanose([5, 0, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});

	it('classifies monospaced font as monospace regardless of family type', () => {
		// bProportion=9 (monospace) with a serif family type
		const result = classifyPanose([2, 2, 5, 9, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('monospace');
	});

	it('defaults to sans-serif for bFamilyType=0 (Any)', () => {
		const result = classifyPanose([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});

	it('defaults to sans-serif for bFamilyType=1 (No Fit)', () => {
		const result = classifyPanose([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});

	it('defaults to sans-serif for an unknown family type', () => {
		const result = classifyPanose([99, 0, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});

	it('defaults to sans-serif for insufficient PANOSE data', () => {
		expect(classifyPanose([])).toBe('sans-serif');
		expect(classifyPanose([2])).toBe('sans-serif');
		expect(classifyPanose([2, 11])).toBe('sans-serif');
	});

	it('treats bSerifStyle=12 (Obtuse Sans) as sans-serif', () => {
		const result = classifyPanose([2, 12, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});

	it('treats bSerifStyle=13 (Perpendicular Sans) as sans-serif', () => {
		const result = classifyPanose([2, 13, 5, 2, 0, 0, 0, 0, 0, 0]);
		expect(result).toBe('sans-serif');
	});
});

// ---------------------------------------------------------------------------
// getPanoseWeight
// ---------------------------------------------------------------------------

describe('getPanoseWeight', () => {
	it('maps PANOSE weight 5 (Medium) to CSS 400', () => {
		expect(getPanoseWeight([2, 11, 5, 4, 2, 2, 2, 2, 2, 4])).toBe(400);
	});

	it('maps PANOSE weight 8 (Bold) to CSS 700', () => {
		expect(getPanoseWeight([2, 11, 8, 4, 2, 2, 2, 2, 2, 4])).toBe(700);
	});

	it('maps PANOSE weight 1 (Very Light) to CSS 100', () => {
		expect(getPanoseWeight([2, 11, 1, 4, 2, 2, 2, 2, 2, 4])).toBe(100);
	});

	it('maps PANOSE weight 11 (Extra Black) to CSS 900', () => {
		expect(getPanoseWeight([2, 11, 11, 4, 2, 2, 2, 2, 2, 4])).toBe(900);
	});

	it('returns undefined for undefined input', () => {
		expect(getPanoseWeight(undefined)).toBeUndefined();
	});

	it('returns undefined for arrays shorter than 3', () => {
		expect(getPanoseWeight([2, 11])).toBeUndefined();
	});

	it('returns undefined for PANOSE weight 0 (not in the map)', () => {
		expect(getPanoseWeight([2, 11, 0, 4, 2, 2, 2, 2, 2, 4])).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getSubstituteFontFamily
// ---------------------------------------------------------------------------

describe('getSubstituteFontFamily', () => {
	it('falls back through Calibri for the Aptos family', () => {
		expect(getSubstituteFontFamily('Aptos')).toBe(
			'"Aptos", "Calibri", "Carlito", "Liberation Sans", "Arial", sans-serif',
		);
		expect(getSubstituteFontFamily('Aptos Display')).toBe(
			'"Aptos Display", "Calibri Light", "Calibri", "Carlito", "Arial", sans-serif',
		);
	});

	it('keeps the serif and mono Aptos faces in their own genre', () => {
		expect(getSubstituteFontFamily('Aptos Serif')).toContain('serif');
		expect(getSubstituteFontFamily('Aptos Serif')).toContain('"Cambria"');
		expect(getSubstituteFontFamily('Aptos Mono')).toContain('monospace');
	});

	it('returns direct substitution chain for Calibri', () => {
		const result = getSubstituteFontFamily('Calibri');
		expect(result).toBe('"Calibri", "Carlito", "Liberation Sans", "Arial", sans-serif');
	});

	it('returns direct substitution chain for Cambria', () => {
		const result = getSubstituteFontFamily('Cambria');
		expect(result).toBe('"Cambria", "Caladea", "Liberation Serif", "Times New Roman", serif');
	});

	it('returns direct substitution chain for Consolas', () => {
		const result = getSubstituteFontFamily('Consolas');
		expect(result).toBe('"Consolas", "Liberation Mono", "Courier New", monospace');
	});

	it('uses a condensed display fallback for Oswald', () => {
		const result = getSubstituteFontFamily('Oswald');
		expect(result).toBe('"Oswald", "Agency FB", "Arial Narrow", sans-serif');
	});

	it('uses PANOSE classification when no direct substitution exists', () => {
		// PANOSE for a sans-serif font: bFamilyType=2, bSerifStyle=11 (Normal Sans)
		const panose = [2, 11, 5, 2, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFontFamily('CustomSansFont', panose);
		expect(result).toBe('"CustomSansFont", "Arial", "Helvetica", sans-serif');
	});

	it('uses PANOSE serif classification correctly', () => {
		// PANOSE for a serif font: bFamilyType=2, bSerifStyle=2 (Cove)
		const panose = [2, 2, 5, 2, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFontFamily('CustomSerifFont', panose);
		expect(result).toBe('"CustomSerifFont", "Times New Roman", "Georgia", serif');
	});

	it('uses PANOSE monospace detection correctly', () => {
		// PANOSE with bProportion=9 (monospaced)
		const panose = [2, 11, 5, 9, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFontFamily('CustomMonoFont', panose);
		expect(result).toBe('"CustomMonoFont", "Courier New", "Consolas", monospace');
	});

	it('uses PANOSE cursive classification correctly', () => {
		// PANOSE for a handwritten font: bFamilyType=3
		const panose = [3, 0, 5, 2, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFontFamily('CustomScript', panose);
		expect(result).toBe('"CustomScript", "Comic Sans MS", cursive');
	});

	it('falls back to sans-serif for unknown fonts without PANOSE data', () => {
		const result = getSubstituteFontFamily('TotallyUnknownFont');
		expect(result).toBe('"TotallyUnknownFont", sans-serif');
	});

	it('returns sans-serif for empty font name', () => {
		expect(getSubstituteFontFamily('')).toBe('sans-serif');
	});

	it('trims whitespace from font name', () => {
		const result = getSubstituteFontFamily('  Calibri  ');
		expect(result).toBe('"Calibri", "Carlito", "Liberation Sans", "Arial", sans-serif');
	});

	it('prefers direct substitution over PANOSE classification', () => {
		// Even with PANOSE data, Calibri should use the direct map
		const panose = [2, 11, 5, 2, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFontFamily('Calibri', panose);
		expect(result).toBe('"Calibri", "Carlito", "Liberation Sans", "Arial", sans-serif');
	});
});

// ---------------------------------------------------------------------------
// getSubstituteFonts
// ---------------------------------------------------------------------------

describe('getSubstituteFonts', () => {
	it('returns the direct substitution list for known fonts', () => {
		const result = getSubstituteFonts('Calibri');
		expect(result).toStrictEqual(['Carlito', 'Liberation Sans', 'Arial', 'sans-serif']);
	});

	it('returns PANOSE-based fallback for unknown fonts with PANOSE data', () => {
		const panose = [2, 2, 5, 2, 2, 2, 2, 2, 2, 4];
		const result = getSubstituteFonts('UnknownSerif', panose);
		expect(result).toStrictEqual(['Times New Roman', 'Georgia', 'serif']);
	});

	it('returns sans-serif fallback for unknown fonts without PANOSE', () => {
		const result = getSubstituteFonts('UnknownFont');
		expect(result).toStrictEqual(['sans-serif']);
	});

	it('returns sans-serif for empty font name', () => {
		expect(getSubstituteFonts('')).toStrictEqual(['sans-serif']);
	});
});

// ---------------------------------------------------------------------------
// hasDirectSubstitution
// ---------------------------------------------------------------------------

describe('hasDirectSubstitution', () => {
	it('returns true for known fonts', () => {
		expect(hasDirectSubstitution('Calibri')).toBeTruthy();
		expect(hasDirectSubstitution('Arial')).toBeTruthy();
		expect(hasDirectSubstitution('Consolas')).toBeTruthy();
		expect(hasDirectSubstitution('Times New Roman')).toBeTruthy();
	});

	it('returns false for unknown fonts', () => {
		expect(hasDirectSubstitution('TotallyUnknown')).toBeFalsy();
		expect(hasDirectSubstitution('')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// buildFontFamilyString
// ---------------------------------------------------------------------------

describe('buildFontFamilyString', () => {
	it('quotes non-generic font names', () => {
		const result = buildFontFamilyString('Arial', ['Helvetica', 'sans-serif']);
		expect(result).toBe('"Arial", "Helvetica", sans-serif');
	});

	it('does not quote CSS generic family keywords', () => {
		const result = buildFontFamilyString('MyFont', ['serif']);
		expect(result).toBe('"MyFont", serif');
	});

	it('avoids duplicates in the font chain', () => {
		const result = buildFontFamilyString('Arial', ['Arial', 'Helvetica', 'sans-serif']);
		expect(result).toBe('"Arial", "Helvetica", sans-serif');
	});

	it('handles a single fallback', () => {
		const result = buildFontFamilyString('MyFont', ['sans-serif']);
		expect(result).toBe('"MyFont", sans-serif');
	});

	it('handles empty fallbacks list', () => {
		const result = buildFontFamilyString('MyFont', []);
		expect(result).toBe('"MyFont"');
	});

	it('handles multiple generic families correctly', () => {
		const result = buildFontFamilyString('MyFont', ['system-ui', 'sans-serif']);
		expect(result).toBe('"MyFont", system-ui, sans-serif');
	});
});

// ---------------------------------------------------------------------------
// FONT_SUBSTITUTION_MAP coverage
// ---------------------------------------------------------------------------

describe('fONT_SUBSTITUTION_MAP', () => {
	it('contains entries for all major Office fonts', () => {
		const expectedFonts = [
			'Calibri',
			'Calibri Light',
			'Cambria',
			'Consolas',
			'Segoe UI',
			'Times New Roman',
			'Arial',
			'Courier New',
			'Verdana',
			'Georgia',
		];
		for (const font of expectedFonts) {
			expect(FONT_SUBSTITUTION_MAP).toHaveProperty(font);
		}
	});

	it('every substitution chain ends with a generic family', () => {
		const genericFamilies = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy']);
		for (const [_fontName, chain] of Object.entries(FONT_SUBSTITUTION_MAP)) {
			const lastItem = chain[chain.length - 1];
			expect(genericFamilies.has(lastItem)).toBeTruthy();
		}
	});

	it('contains CJK font mappings', () => {
		expect(FONT_SUBSTITUTION_MAP).toHaveProperty('MS PGothic');
		expect(FONT_SUBSTITUTION_MAP).toHaveProperty('SimSun');
		expect(FONT_SUBSTITUTION_MAP).toHaveProperty('Malgun Gothic');
	});

	it('contains complex script font mappings', () => {
		expect(FONT_SUBSTITUTION_MAP).toHaveProperty('Mangal');
		expect(FONT_SUBSTITUTION_MAP).toHaveProperty('Leelawadee UI');
	});
});

// ---------------------------------------------------------------------------
// PANOSE constants sanity checks
// ---------------------------------------------------------------------------

describe('pANOSE constants', () => {
	it('pANOSE_FAMILY_MAP covers all standard family types (0-5)', () => {
		for (let i = 0; i <= 5; i++) {
			expect(PANOSE_FAMILY_MAP[i]).toBeDefined();
		}
	});

	it('pANOSE_WEIGHT_MAP covers weights 1-11', () => {
		for (let i = 1; i <= 11; i++) {
			expect(PANOSE_WEIGHT_MAP[i]).toBeDefined();
			expect(PANOSE_WEIGHT_MAP[i]).toBeGreaterThanOrEqual(100);
			expect(PANOSE_WEIGHT_MAP[i]).toBeLessThanOrEqual(900);
		}
	});

	it('pANOSE_MONOSPACE_PROPORTION is 9', () => {
		expect(PANOSE_MONOSPACE_PROPORTION).toBe(9);
	});

	it('pANOSE_SANS_SERIF_STYLES contains expected values', () => {
		expect(PANOSE_SANS_SERIF_STYLES.has(11)).toBeTruthy();
		expect(PANOSE_SANS_SERIF_STYLES.has(12)).toBeTruthy();
		expect(PANOSE_SANS_SERIF_STYLES.has(13)).toBeTruthy();
		// Value 2 is Cove — not sans-serif
		expect(PANOSE_SANS_SERIF_STYLES.has(2)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Integration: parsePanoseString → classifyPanose → getSubstituteFontFamily
// ---------------------------------------------------------------------------

describe('end-to-end PANOSE font substitution', () => {
	it('arial PANOSE string → sans-serif classification', () => {
		// Arial: 020B0604020202020204
		const panose = parsePanoseString('020B0604020202020204');
		expect(panose).toBeDefined();
		expect(classifyPanose(panose!)).toBe('sans-serif');

		const result = getSubstituteFontFamily('Arial', panose!);
		// Arial has direct substitution, so it uses that
		expect(result).toContain('"Arial"');
		expect(result).toContain('sans-serif');
	});

	it('times New Roman PANOSE string → serif classification', () => {
		// Times New Roman: 02020603050405020304
		const panose = parsePanoseString('02020603050405020304');
		expect(panose).toBeDefined();
		expect(classifyPanose(panose!)).toBe('serif');
	});

	it('courier New PANOSE string → monospace classification', () => {
		// Courier New: 02070309020205020404 — bProportion=9 (monospace)
		const panose = parsePanoseString('02070309020205020404');
		expect(panose).toBeDefined();
		expect(classifyPanose(panose!)).toBe('monospace');
	});

	it('unknown font with parsed PANOSE gets correct classification', () => {
		// A serif PANOSE: family=2 (Latin Text), serif=5 (Square Cove), proportion=2
		const panose = parsePanoseString('02050502020202020202');
		expect(panose).toBeDefined();

		const result = getSubstituteFontFamily('MySerif', panose!);
		expect(result).toContain('"MySerif"');
		expect(result).toContain('"Times New Roman"');
		expect(result).toContain('serif');
	});
});

describe('stripFontStyleSuffix', () => {
	it('strips a single trailing style token', () => {
		expect(stripFontStyleSuffix('Bebas Neue Regular')).toBe('Bebas Neue');
		expect(stripFontStyleSuffix('微软雅黑 Light')).toBe('微软雅黑');
		expect(stripFontStyleSuffix('思源黑体 CN Light')).toBe('思源黑体 CN');
	});

	it('strips up to two tokens (weight + italic)', () => {
		expect(stripFontStyleSuffix('Segoe UI Semibold Italic')).toBe('Segoe UI');
	});

	it('returns undefined when nothing was stripped', () => {
		expect(stripFontStyleSuffix('Arial')).toBeUndefined();
		expect(stripFontStyleSuffix('Bebas Neue')).toBeUndefined();
	});

	it('never strips a name down to nothing', () => {
		expect(stripFontStyleSuffix('Light')).toBeUndefined();
	});
});

describe('style-suffixed full names in the chain', () => {
	it('adds the family base right after the full name (issue #132, "77%")', () => {
		// "Bebas Neue Regular" is the FULL name; the OS registers "Bebas Neue".
		// The base must join the chain along with the condensed fallbacks, or
		// numeric labels sized for the narrow face wrap and clip.
		const css = getSubstituteFontFamily('Bebas Neue Regular');
		expect(css).toBe(
			'"Bebas Neue Regular", "Bebas Neue", "Oswald", "Arial Narrow", "Impact", sans-serif',
		);
	});

	it('routes a suffixed CJK name through the base substitution entry', () => {
		const css = getSubstituteFontFamily('思源黑体 CN Light');
		expect(css).toContain('"思源黑体 CN"');
		expect(css).toContain('"Noto Sans CJK SC"');
		expect(css).toContain('"Microsoft YaHei"');
	});

	it('keeps a genuine weight-named family first in its own chain', () => {
		// "Arial Black" IS a family with its own map entry; the full name must
		// stay first so the installed face keeps winning.
		expect(getSubstituteFontFamily('Arial Black').startsWith('"Arial Black"')).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Aptos metric-compatible match
//
// Aptos is not installed on a typical reader's machine and has no metric
// clone of its own on Google Fonts, so its CSS chain (and the webfont loader
// in `pptx-viewer-shared/render/google-webfonts.ts`) fall back through
// Calibri -> Carlito. This suite verifies that choice numerically against
// the REAL, COM-measured Aptos advance table in
// `font-advance-widths-aptos.generated.ts`, comparing it to every other font
// this repo has a real measured table for (Carlito/Arimo/Tinos/Cousine/
// Caladea/Gelasio have none; Carlito is Calibri's own metric clone by
// construction, so "closest measured table" and "closest loadable webfont"
// coincide here).
// ---------------------------------------------------------------------------

describe('aptos metric-compatible match', () => {
	/**
	 * Frequency-weighted average absolute per-glyph advance-width error
	 * (per-1000-em) between two advance tables, weighted by each letter's
	 * share of running English body text (space ~17.5%, then standard
	 * letter frequencies for a-z). A frequency weighting is used, rather
	 * than a flat average over all measured code points or the width of one
	 * arbitrary test string, because rare punctuation should not count as
	 * much as common letters, and a single string's over/under estimates
	 * can cancel out and misleadingly understate the real error.
	 */
	function weightedAdvanceError(a: FontAdvanceTable, b: FontAdvanceTable): number {
		const LETTER_FREQUENCY_PCT: Record<string, number> = {
			e: 12.7,
			t: 9.1,
			a: 8.2,
			o: 7.5,
			i: 7.0,
			n: 6.7,
			s: 6.3,
			h: 6.1,
			r: 6.0,
			d: 4.3,
			l: 4.0,
			c: 2.8,
			u: 2.8,
			m: 2.4,
			w: 2.4,
			f: 2.2,
			g: 2.0,
			y: 2.0,
			p: 1.9,
			b: 1.5,
			v: 1.0,
			k: 0.8,
			j: 0.15,
			x: 0.15,
			q: 0.1,
			z: 0.07,
		};
		const SPACE_SHARE_PCT = 17.5;
		const letterTotal = Object.values(LETTER_FREQUENCY_PCT).reduce((sum, pct) => sum + pct, 0);
		const scale = (100 - SPACE_SHARE_PCT) / letterTotal;
		const weights = new Map<number, number>([[32, SPACE_SHARE_PCT]]);
		for (const [letter, pct] of Object.entries(LETTER_FREQUENCY_PCT)) {
			weights.set(letter.codePointAt(0)!, pct * scale);
		}

		let weightedSum = 0;
		let weightTotal = 0;
		for (const [code, weight] of weights) {
			const aAdvance = a.advances[code];
			const bAdvance = b.advances[code];
			if (aAdvance === undefined || bAdvance === undefined) {
				continue;
			}
			weightedSum += weight * Math.abs(aAdvance - bAdvance);
			weightTotal += weight;
		}
		return weightedSum / weightTotal;
	}

	const candidates: Record<string, FontAdvanceTable> = {
		Calibri: CALIBRI_TABLE,
		'Calibri Light': CALIBRI_LIGHT_TABLE,
		Arial: ARIAL_TABLE,
		'Segoe UI': SEGOE_UI_TABLE,
		'Times New Roman': TIMES_NEW_ROMAN_TABLE,
	};

	it('calibri has the smallest frequency-weighted advance-width error of the measured candidates', () => {
		const errors = Object.fromEntries(
			Object.entries(candidates).map(([name, table]) => [
				name,
				weightedAdvanceError(APTOS_TABLE, table),
			]),
		);
		const smallest = Object.entries(errors).sort(([, a], [, b]) => a - b)[0];
		expect(smallest?.[0]).toBe('Calibri');
		// Regression guard on the actual measured magnitude, not just the
		// ranking: per-1000-em error should stay under 3.5% (35 units) of the
		// em square for the winning candidate, matching the real measurement.
		expect(errors.Calibri).toBeLessThan(35);
	});

	it("calibri's chain leads to Carlito, which is Calibri's own metric clone", () => {
		// Carlito was built by copying Calibri's hmtx (advance width) table
		// directly (an established, documented fact about the Carlito/Calibri
		// metric-compatible font project), so it carries the same measured
		// closeness to Aptos verified above without this repo needing its own
		// Carlito advance table.
		expect(getSubstituteFonts('Aptos')).toContain('Calibri');
		expect(getSubstituteFonts('Aptos')).toContain('Carlito');
		expect(getSubstituteFonts('Aptos').indexOf('Carlito')).toBeGreaterThan(
			getSubstituteFonts('Aptos').indexOf('Calibri'),
		);
	});
});
