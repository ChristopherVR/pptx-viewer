import { describe, it, expect } from 'vitest';

import type { PlaceholderTextLevelStyle, TextStyle, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

// ---------------------------------------------------------------------------
// Regression coverage for themed bullet colours (issue #75).
//
// The `a:buClr` bullet colour must route through the shared `parseColor`
// helper so scheme / sys / prst / hsl / scrgb colour choices resolve, not
// only the literal `a:srgbClr/@_val`. A `<a:buClr><a:schemeClr val="accent1"/>`
// is standard in the Office master bodyStyle, so dropping it left bullets
// with no / incorrect colour.
// ---------------------------------------------------------------------------

/**
 * Thin subclass that seeds a deterministic theme colour map and exposes the
 * otherwise-protected `parsePlaceholderLevelStyle` for direct assertion.
 */
class TestRuntime extends PptxHandlerRuntime {
	public constructor() {
		super();
		// Seed the live theme map so `a:schemeClr` references resolve.
		(this as unknown as { themeColorMap: Record<string, string> }).themeColorMap = {
			accent1: '#0070C0',
		};
	}

	public parseLevelStyle(levelProps: XmlObject | undefined): PlaceholderTextLevelStyle | null {
		return this.parsePlaceholderLevelStyle(levelProps);
	}

	public applyLevelDefaults(textStyle: TextStyle, levelStyle: PlaceholderTextLevelStyle): void {
		this.applyPlaceholderLevelDefaults(textStyle, levelStyle);
	}
}

describe('parsePlaceholderLevelStyle - bullet colour', () => {
	it('resolves a themed a:schemeClr bullet colour to the theme accent1', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:schemeClr': { '@_val': 'accent1' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style).not.toBeNull();
		expect(style?.bulletColor).toBe('#0070C0');
	});

	it('still resolves a plain a:srgbClr bullet colour', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBe('#FF0000');
	});

	it('resolves an a:sysClr bullet colour via its lastClr', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buClr': { 'a:sysClr': { '@_val': 'windowText', '@_lastClr': '000000' } },
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBe('#000000');
	});

	it('leaves bulletColor unset when no a:buClr is present', () => {
		const runtime = new TestRuntime();
		const levelProps: XmlObject = {
			'a:buChar': { '@_char': '•' },
		};

		const style = runtime.parseLevelStyle(levelProps);
		expect(style?.bulletColor).toBeUndefined();
		expect(style?.bulletColorXml).toBeUndefined();
	});

	it('keeps the authored a:schemeClr node alongside the resolved hex', () => {
		const runtime = new TestRuntime();
		const style = runtime.parseLevelStyle({
			'a:buClr': { 'a:schemeClr': { '@_val': 'accent1', 'a:lumMod': { '@_val': '75000' } } },
			'a:buChar': { '@_char': '•' },
		});
		expect(style?.bulletColorXml).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent1', 'a:lumMod': { '@_val': '75000' } },
		});
	});
});

// ---------------------------------------------------------------------------
// The level parser must carry the same paragraph field set as a directly
// authored `a:pPr`: it used to drop marR / rtl / tabLst outright and folded
// `justLow` / `dist` / `thaiDist` to lower-case strings no render branch
// matched.
// ---------------------------------------------------------------------------

describe('parsePlaceholderLevelStyle - paragraph attribute parity with a:pPr', () => {
	const fullLevel: XmlObject = {
		'@_marL': '342900',
		'@_marR': '190500',
		'@_indent': '-342900',
		'@_algn': 'thaiDist',
		'@_rtl': '1',
		'@_defTabSz': '914400',
		'@_eaLnBrk': '1',
		'@_latinLnBrk': '0',
		'@_fontAlgn': 'base',
		'@_hangingPunct': '1',
		'a:tabLst': {
			'a:tab': [
				{ '@_pos': '914400', '@_algn': 'l' },
				{ '@_pos': '1828800', '@_algn': 'dec', '@_leader': 'dot' },
			],
		},
		'a:buClr': { 'a:schemeClr': { '@_val': 'accent1' } },
		'a:buChar': { '@_char': '•' },
		'a:defRPr': { '@_sz': '2000' },
	};

	it('parses every paragraph attribute into the typed level style', () => {
		const style = new TestRuntime().parseLevelStyle(fullLevel);
		expect(style).toMatchObject({
			marginLeft: 36,
			marginRight: 20,
			indent: -36,
			alignment: 'thaiDist',
			rtl: true,
			defaultTabSize: 96,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
			tabStops: [
				{ position: 96, align: 'l' },
				{ position: 192, align: 'dec', leader: 'dot' },
			],
			bulletColor: '#0070C0',
			bulletColorXml: { 'a:schemeClr': { '@_val': 'accent1' } },
		});
	});

	it.each([
		['l', 'left'],
		['ctr', 'center'],
		['r', 'right'],
		['just', 'justify'],
		['justLow', 'justLow'],
		['dist', 'dist'],
		['thaiDist', 'thaiDist'],
	])('maps algn="%s" to the case-sensitive %s token', (algn, expected) => {
		const style = new TestRuntime().parseLevelStyle({ '@_algn': algn });
		expect(style?.alignment).toBe(expected);
	});

	it('drops an alignment token that is not a valid ST_TextAlignType', () => {
		const style = new TestRuntime().parseLevelStyle({ '@_algn': 'middle', '@_marL': '0' });
		expect(style?.alignment).toBeUndefined();
	});

	it('leaves the new fields unset when the level does not declare them', () => {
		const style = new TestRuntime().parseLevelStyle({ '@_marL': '0' });
		expect(style?.marginRight).toBeUndefined();
		expect(style?.rtl).toBeUndefined();
		expect(style?.tabStops).toBeUndefined();
	});
});

describe('applyPlaceholderLevelDefaults - cascade of the added fields', () => {
	const level: PlaceholderTextLevelStyle = {
		marginRight: 20,
		rtl: true,
		alignment: 'thaiDist',
		tabStops: [{ position: 96, align: 'ctr' }],
	};

	it('fills undefined paragraph slots from the level style', () => {
		const textStyle: TextStyle = {};
		new TestRuntime().applyLevelDefaults(textStyle, level);
		expect(textStyle.paragraphMarginRight).toBe(20);
		expect(textStyle.rtl).toBeTruthy();
		expect(textStyle.align).toBe('thaiDist');
		expect(textStyle.tabStops).toStrictEqual([{ position: 96, align: 'ctr' }]);
		// The cascade hands out a copy: mutating the paragraph must not leak
		// back into the shared, cached level style.
		expect(textStyle.tabStops).not.toBe(level.tabStops);
	});

	it('never overrides values the paragraph already declares', () => {
		const textStyle: TextStyle = {
			paragraphMarginRight: 0,
			rtl: false,
			align: 'left',
			tabStops: [],
		};
		new TestRuntime().applyLevelDefaults(textStyle, level);
		expect(textStyle.paragraphMarginRight).toBe(0);
		expect(textStyle.rtl).toBeFalsy();
		expect(textStyle.align).toBe('left');
		expect(textStyle.tabStops).toStrictEqual([]);
	});
});
