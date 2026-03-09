import { describe, it, expect } from 'vitest';
import {
	detectFontScript,
	segmentByScript,
	resolveFontForScript,
	hasDistinctScriptFonts,
} from './unicode-script-detection';

describe('detectFontScript', () => {
	it('should classify ASCII letters as latin', () => {
		expect(detectFontScript('A'.codePointAt(0)!)).toBe('latin');
		expect(detectFontScript('z'.codePointAt(0)!)).toBe('latin');
		expect(detectFontScript('0'.codePointAt(0)!)).toBe('latin');
	});

	it('should classify CJK unified ideographs as eastAsia', () => {
		// U+4E2D = Chinese character for "middle"
		expect(detectFontScript(0x4e2d)).toBe('eastAsia');
	});

	it('should classify Hiragana as eastAsia', () => {
		// U+3042 = Hiragana "a"
		expect(detectFontScript(0x3042)).toBe('eastAsia');
	});

	it('should classify Katakana as eastAsia', () => {
		// U+30A2 = Katakana "a"
		expect(detectFontScript(0x30a2)).toBe('eastAsia');
	});

	it('should classify Hangul syllables as eastAsia', () => {
		// U+AC00 = first Hangul syllable
		expect(detectFontScript(0xac00)).toBe('eastAsia');
	});

	it('should classify Arabic as complexScript', () => {
		// U+0627 = Arabic Alef
		expect(detectFontScript(0x0627)).toBe('complexScript');
	});

	it('should classify Hebrew as complexScript', () => {
		// U+05D0 = Hebrew Alef
		expect(detectFontScript(0x05d0)).toBe('complexScript');
	});

	it('should classify Devanagari as complexScript', () => {
		// U+0905 = Devanagari A
		expect(detectFontScript(0x0905)).toBe('complexScript');
	});

	it('should classify Thai as complexScript', () => {
		// U+0E01 = Thai Ko Kai
		expect(detectFontScript(0x0e01)).toBe('complexScript');
	});

	it('should classify mathematical operators as symbol', () => {
		// U+2200 = "for all" symbol
		expect(detectFontScript(0x2200)).toBe('symbol');
	});

	it('should classify dingbats as symbol', () => {
		// U+2702 = scissors dingbat
		expect(detectFontScript(0x2702)).toBe('symbol');
	});

	it('should classify arrows as symbol', () => {
		// U+2190 = leftwards arrow
		expect(detectFontScript(0x2190)).toBe('symbol');
	});

	it('should classify accented Latin characters as latin', () => {
		// U+00E9 = e with acute accent
		expect(detectFontScript(0x00e9)).toBe('latin');
	});

	it('should classify Greek letters as latin (not separate)', () => {
		// U+0391 = Greek capital Alpha
		expect(detectFontScript(0x0391)).toBe('latin');
	});

	it('should classify Cyrillic letters as latin (not separate)', () => {
		// U+0410 = Cyrillic capital A
		expect(detectFontScript(0x0410)).toBe('latin');
	});
});

describe('segmentByScript', () => {
	it('should return empty array for empty string', () => {
		expect(segmentByScript('')).toEqual([]);
	});

	it('should return single run for pure Latin text', () => {
		const runs = segmentByScript('Hello World');
		expect(runs.length).toBe(1);
		expect(runs[0].script).toBe('latin');
		expect(runs[0].text).toBe('Hello World');
		expect(runs[0].startIndex).toBe(0);
	});

	it('should segment mixed Latin and CJK text', () => {
		const runs = segmentByScript('Hello\u4e16\u754c');
		expect(runs.length).toBe(2);
		expect(runs[0].script).toBe('latin');
		expect(runs[0].text).toBe('Hello');
		expect(runs[1].script).toBe('eastAsia');
	});

	it('should inherit punctuation script from previous run', () => {
		// Space and punctuation are "neutral" and inherit the previous run's script
		const runs = segmentByScript('Hello, World');
		expect(runs.length).toBe(1);
		expect(runs[0].text).toBe('Hello, World');
	});

	it('should handle pure CJK text', () => {
		const runs = segmentByScript('\u4f60\u597d\u4e16\u754c');
		expect(runs.length).toBe(1);
		expect(runs[0].script).toBe('eastAsia');
	});

	it('should handle text starting with punctuation', () => {
		const runs = segmentByScript('...Hello');
		// Leading punctuation with no previous script defaults to latin
		expect(runs.length).toBe(1);
		expect(runs[0].script).toBe('latin');
	});

	it('should handle Arabic followed by Latin', () => {
		// U+0627 = Arabic Alef, U+0628 = Arabic Ba
		const runs = segmentByScript('\u0627\u0628Hello');
		expect(runs.length).toBe(2);
		expect(runs[0].script).toBe('complexScript');
		expect(runs[1].script).toBe('latin');
	});

	it('should preserve start indices', () => {
		const runs = segmentByScript('AB\u4e2d\u6587');
		expect(runs[0].startIndex).toBe(0);
		expect(runs[1].startIndex).toBe(2);
	});
});

describe('resolveFontForScript', () => {
	const fonts = {
		latin: 'Arial',
		eastAsia: 'MS Mincho',
		complexScript: 'Tahoma',
		symbol: 'Wingdings',
	};

	it('should return latin font for latin script', () => {
		expect(resolveFontForScript('latin', fonts)).toBe('Arial');
	});

	it('should return eastAsia font for eastAsia script', () => {
		expect(resolveFontForScript('eastAsia', fonts)).toBe('MS Mincho');
	});

	it('should return complexScript font for complexScript', () => {
		expect(resolveFontForScript('complexScript', fonts)).toBe('Tahoma');
	});

	it('should return symbol font for symbol script', () => {
		expect(resolveFontForScript('symbol', fonts)).toBe('Wingdings');
	});

	it('should fall back to latin when eastAsia font is missing', () => {
		expect(
			resolveFontForScript('eastAsia', { latin: 'Arial' }),
		).toBe('Arial');
	});

	it('should fall back to latin when complexScript font is missing', () => {
		expect(
			resolveFontForScript('complexScript', { latin: 'Arial' }),
		).toBe('Arial');
	});

	it('should fall back to latin when symbol font is missing', () => {
		expect(
			resolveFontForScript('symbol', { latin: 'Arial' }),
		).toBe('Arial');
	});

	it('should return undefined when no fonts are available', () => {
		expect(resolveFontForScript('latin', {})).toBeUndefined();
	});
});

describe('hasDistinctScriptFonts', () => {
	it('should return false when no base latin font is set', () => {
		expect(hasDistinctScriptFonts({})).toBe(false);
	});

	it('should return false when all fonts match latin', () => {
		expect(
			hasDistinctScriptFonts({
				latin: 'Arial',
				eastAsia: 'Arial',
				complexScript: 'Arial',
				symbol: 'Arial',
			}),
		).toBe(false);
	});

	it('should return true when eastAsia differs from latin', () => {
		expect(
			hasDistinctScriptFonts({
				latin: 'Arial',
				eastAsia: 'MS Mincho',
			}),
		).toBe(true);
	});

	it('should return true when complexScript differs from latin', () => {
		expect(
			hasDistinctScriptFonts({
				latin: 'Arial',
				complexScript: 'Tahoma',
			}),
		).toBe(true);
	});

	it('should return true when symbol differs from latin', () => {
		expect(
			hasDistinctScriptFonts({
				latin: 'Arial',
				symbol: 'Wingdings',
			}),
		).toBe(true);
	});

	it('should return false when only latin is set (no script-specific fonts)', () => {
		expect(hasDistinctScriptFonts({ latin: 'Arial' })).toBe(false);
	});
});
