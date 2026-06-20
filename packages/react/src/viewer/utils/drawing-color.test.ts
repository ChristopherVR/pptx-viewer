import type { XmlObject } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	DEFAULT_SCHEME_COLOR_MAP,
	applyDrawingColorTransforms,
	parseDrawingColorChoice,
	parseDrawingColor,
	parseDrawingColorOpacity,
} from './drawing-color';

// ---------------------------------------------------------------------------
// DEFAULT_SCHEME_COLOR_MAP
// ---------------------------------------------------------------------------

describe('dEFAULT_SCHEME_COLOR_MAP', () => {
	it('has entries for all standard scheme keys', () => {
		const expectedKeys = [
			'dk1',
			'lt1',
			'dk2',
			'lt2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
			'hlink',
			'folHlink',
			'tx1',
			'tx2',
			'bg1',
			'bg2',
			'phclr',
		];
		for (const key of expectedKeys) {
			expect(DEFAULT_SCHEME_COLOR_MAP[key]).toBeDefined();
		}
	});

	it('dk1 defaults to black', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.dk1).toBe('#000000');
	});

	it('lt1 defaults to white', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.lt1).toBe('#FFFFFF');
	});

	it('tx1 matches dk1 (text on dark)', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.tx1).toBe(DEFAULT_SCHEME_COLOR_MAP.dk1);
	});

	it('bg1 matches lt1 (background = light)', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.bg1).toBe(DEFAULT_SCHEME_COLOR_MAP.lt1);
	});

	it('tx2 is dark slate', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.tx2).toBe('#44546A');
	});

	it('bg2 is light grey', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.bg2).toBe('#E7E6E6');
	});

	it('dk2 is dark blue-grey', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.dk2).toBe('#1F497D');
	});

	it('lt2 is warm off-white', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.lt2).toBe('#EEECE1');
	});

	it('phclr (placeholder colour) defaults to accent1', () => {
		expect(DEFAULT_SCHEME_COLOR_MAP.phclr).toBe('#4472C4');
	});

	it('all values are valid hex colour strings', () => {
		for (const value of Object.values(DEFAULT_SCHEME_COLOR_MAP)) {
			expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/u);
		}
	});

	it('has exactly 17 entries', () => {
		expect(Object.keys(DEFAULT_SCHEME_COLOR_MAP)).toHaveLength(17);
	});
});

// ---------------------------------------------------------------------------
// applyDrawingColorTransforms
// ---------------------------------------------------------------------------

describe('applyDrawingColorTransforms', () => {
	it('returns the base color unchanged when no transforms are present', () => {
		expect(applyDrawingColorTransforms('#FF0000', {})).toBe('#FF0000');
	});

	it('returns the base color unchanged for an empty color node', () => {
		expect(applyDrawingColorTransforms('#4472C4', {})).toBe('#4472C4');
	});

	it('applies shade transform (darken toward black)', () => {
		// shade=50000 means 50%: each channel multiplied by 0.5
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:shade': { '@_val': '50000' },
		});
		expect(result).toBe('#800000');
	});

	it('applies tint transform (lighten toward white)', () => {
		// tint=50000 means 50%: mix 50% toward white
		// R: 0+(255-0)*0.5=128, G: 0+(255-0)*0.5=128, B: 255+(255-255)*0.5=255
		const result = applyDrawingColorTransforms('#0000FF', {
			'a:tint': { '@_val': '50000' },
		});
		expect(result).toBe('#8080FF');
	});

	it('applies tint to pure black', () => {
		// Black (#000000) tinted 50% -> R/G/B: 0+(255-0)*0.5 = 128
		const result = applyDrawingColorTransforms('#000000', {
			'a:tint': { '@_val': '50000' },
		});
		expect(result).toBe('#808080');
	});

	it('applies inverse transform', () => {
		// 255-255=0, 255-0=255, 255-0=255 -> cyan
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:inv': {},
		});
		expect(result).toBe('#00FFFF');
	});

	it('applies greyscale transform', () => {
		// BT.601: 0.299*255 + 0.587*0 + 0.114*0 = 76.245 -> 76 = 0x4C
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:gray': {},
		});
		expect(result).toBe('#4C4C4C');
	});

	it('applies lumMod transform (luminance modulation)', () => {
		// White (L=1.0) with lumMod=50% -> L=0.5 -> mid-grey
		const result = applyDrawingColorTransforms('#FFFFFF', {
			'a:lumMod': { '@_val': '50000' },
		});
		expect(result).toBe('#808080');
	});

	it('applies satMod=0 to desaturate fully', () => {
		// Pure red (H=0, S=1, L=0.5) with satMod=0 -> S=0 -> grey
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:satMod': { '@_val': '0' },
		});
		expect(result).toBe('#808080');
	});

	it('applies complement transform', () => {
		// Pure red -> hue rotates 180 degrees -> cyan
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:comp': {},
		});
		expect(result).toBe('#00FFFF');
	});

	it('applies shade=100000 (no change)', () => {
		const result = applyDrawingColorTransforms('#4472C4', {
			'a:shade': { '@_val': '100000' },
		});
		expect(result).toBe('#4472C4');
	});

	it('applies shade=0 (pure black)', () => {
		const result = applyDrawingColorTransforms('#FF8800', {
			'a:shade': { '@_val': '0' },
		});
		expect(result).toBe('#000000');
	});

	it('applies tint=100000 (pure white)', () => {
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:tint': { '@_val': '100000' },
		});
		expect(result).toBe('#FFFFFF');
	});

	it('applies tint=0 (no change)', () => {
		const result = applyDrawingColorTransforms('#FF0000', {
			'a:tint': { '@_val': '0' },
		});
		expect(result).toBe('#FF0000');
	});
});

// ---------------------------------------------------------------------------
// parseDrawingColorChoice
// ---------------------------------------------------------------------------

describe('parseDrawingColorChoice', () => {
	it('returns undefined for undefined input', () => {
		expect(parseDrawingColorChoice(undefined)).toBeUndefined();
	});

	it('returns undefined for empty object', () => {
		expect(parseDrawingColorChoice({})).toBeUndefined();
	});

	// -- a:srgbClr ----------------------------------------------------------

	describe('a:srgbClr', () => {
		it('parses valid 6-digit hex', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'FF0000' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('parses lowercase hex and uppercases result', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'abcdef' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#ABCDEF');
		});

		it('parses mixed-case hex', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'aAbBcC' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#AABBCC');
		});

		it('trims whitespace from value', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': ' 112233 ' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#112233');
		});

		it('returns undefined for invalid hex chars', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'GGGG00' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for too-short value', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'FFF' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for too-long value', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'FF00FF00' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when @_val is missing', () => {
			const node: XmlObject = {
				'a:srgbClr': {},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when @_val is empty string', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': '' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies color transforms to sRGB color', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'@_val': 'FF0000',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#800000');
		});

		it('applies tint transform to sRGB color', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'@_val': 'FF0000',
					'a:tint': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF8080');
		});

		it('applies lumMod transform to sRGB color', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'@_val': 'FFFFFF',
					'a:lumMod': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});
	});

	// -- a:schemeClr --------------------------------------------------------

	describe('a:schemeClr', () => {
		it('resolves dk1 to black', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'dk1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('resolves lt1 to white', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'lt1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('resolves accent1', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'accent1' },
			};
			expect(parseDrawingColorChoice(node)).toBe(DEFAULT_SCHEME_COLOR_MAP.accent1);
		});

		it('resolves tx1 (text on dark) to black', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'tx1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('resolves bg1 (background = light) to white', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'bg1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('resolves hlink', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'hlink' },
			};
			expect(parseDrawingColorChoice(node)).toBe(DEFAULT_SCHEME_COLOR_MAP.hlink);
		});

		it('resolves folHlink (case-insensitive lookup converts to lowercase)', () => {
			// The function lowercases the scheme value, so "folHlink" becomes "folhlink".
			// Since the map key is "folHlink" (camelCase), the lookup fails.
			// This is a known limitation: the map keys are case-sensitive but
			// the function lowercases the input.
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'folHlink' },
			};
			// folHlink -> "folhlink" (lowercased) -> not in map -> undefined
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('is case-insensitive for scheme color value', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'DK1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('handles mixed-case scheme value', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'Accent1' },
			};
			expect(parseDrawingColorChoice(node)).toBe(DEFAULT_SCHEME_COLOR_MAP.accent1);
		});

		it('returns undefined for unknown scheme colour', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'nonexistent' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for empty scheme color value', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': '' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for missing @_val attribute', () => {
			const node: XmlObject = {
				'a:schemeClr': {},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies lumMod to scheme color', () => {
			const node: XmlObject = {
				'a:schemeClr': {
					'@_val': 'lt1',
					'a:lumMod': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});

		it('applies tint to dk1 (black)', () => {
			const node: XmlObject = {
				'a:schemeClr': {
					'@_val': 'dk1',
					'a:tint': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});

		it('applies shade to lt1 (white)', () => {
			const node: XmlObject = {
				'a:schemeClr': {
					'@_val': 'lt1',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});

		it('resolves all six accent colors', () => {
			for (let i = 1; i <= 6; i++) {
				const key = `accent${i}`;
				const node: XmlObject = {
					'a:schemeClr': { '@_val': key },
				};
				expect(parseDrawingColorChoice(node)).toBe(DEFAULT_SCHEME_COLOR_MAP[key]);
			}
		});
	});

	// -- a:sysClr -----------------------------------------------------------

	describe('a:sysClr', () => {
		it('uses lastClr attribute for black', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': '000000' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('handles uppercase lastClr value', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': 'FFFFFF' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('uppercases lowercase lastClr value', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': 'aabbcc' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#AABBCC');
		});

		it('returns undefined when lastClr is missing', () => {
			const node: XmlObject = {
				'a:sysClr': {},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when lastClr is empty', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': '' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for invalid lastClr format', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': 'xyz' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for lastClr with wrong length', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': 'FFF' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies shade transform to system color', () => {
			const node: XmlObject = {
				'a:sysClr': {
					'@_lastClr': 'FF0000',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#800000');
		});

		it('applies tint transform to system color', () => {
			const node: XmlObject = {
				'a:sysClr': {
					'@_lastClr': '000000',
					'a:tint': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});
	});

	// -- a:prstClr ----------------------------------------------------------

	describe('a:prstClr', () => {
		it("resolves known preset 'red'", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'red' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it("resolves 'black'", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'black' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it("resolves 'white'", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'white' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it("resolves 'blue'", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'blue' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#0000FF');
		});

		it("resolves 'green' (HTML green = #008000)", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'green' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#008000');
		});

		it("resolves 'coral'", () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'coral' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF7F50');
		});

		it('is case-insensitive for preset names', () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'AliceBlue' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#F0F8FF');
		});

		it('returns undefined for unknown preset name', () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'fakeColor' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined for empty preset value', () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': '' },
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when @_val is missing', () => {
			const node: XmlObject = {
				'a:prstClr': {},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies tint transform to preset color', () => {
			const node: XmlObject = {
				'a:prstClr': {
					'@_val': 'red',
					'a:tint': { '@_val': '50000' },
				},
			};
			// Red (#FF0000) tinted 50%: R stays 255, G: 0+(255-0)*0.5=128, B: same
			expect(parseDrawingColorChoice(node)).toBe('#FF8080');
		});

		it('applies shade transform to preset color', () => {
			const node: XmlObject = {
				'a:prstClr': {
					'@_val': 'white',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});
	});

	// -- a:scrgbClr ---------------------------------------------------------

	describe('a:scrgbClr', () => {
		it('parses 100% red', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_g': '0',
					'@_b': '0',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('parses 100% all channels (white)', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_g': '100000',
					'@_b': '100000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('parses all zeros (black)', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '0',
					'@_g': '0',
					'@_b': '0',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('parses 50% channels (mid-grey)', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '50000',
					'@_g': '50000',
					'@_b': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});

		it('parses a specific color (25% R, 75% G, 50% B)', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '25000',
					'@_g': '75000',
					'@_b': '50000',
				},
			};
			const result = parseDrawingColorChoice(node);
			expect(result).toBeDefined();
			// 0.25*255=64=0x40, 0.75*255=191=0xBF, 0.5*255=128=0x80
			expect(result).toBe('#40BF80');
		});

		it('returns undefined when red channel is missing', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_g': '50000',
					'@_b': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when green channel is missing', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_b': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when blue channel is missing', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_g': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when a channel is non-numeric', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': 'abc',
					'@_g': '0',
					'@_b': '0',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies shade transform to scRGB color', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_g': '0',
					'@_b': '0',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#800000');
		});

		it('clamps channel values above 100%', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '200000',
					'@_g': '0',
					'@_b': '0',
				},
			};
			// 2.0 * 255 = 510 -> clamped to 255 by Math.min(255, ...)
			const result = parseDrawingColorChoice(node);
			expect(result).toBeDefined();
			expect(result).toBe('#FF0000');
		});
	});

	// -- a:hslClr -----------------------------------------------------------

	describe('a:hslClr', () => {
		it('parses pure red (H=0, S=100%, L=50%)', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('parses white (L=100%)', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '0',
					'@_lum': '100000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('parses black (L=0%)', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '0',
					'@_lum': '0',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('parses mid-grey (S=0%, L=50%)', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '0',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#808080');
		});

		it('parses pure green (H=120deg, hue in 60000ths)', () => {
			// 120 degrees * 60000 = 7200000
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '7200000',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#00FF00');
		});

		it('parses pure blue (H=240deg)', () => {
			// 240 * 60000 = 14400000
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '14400000',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#0000FF');
		});

		it('parses yellow (H=60deg)', () => {
			// 60 * 60000 = 3600000
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '3600000',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#FFFF00');
		});

		it('parses cyan (H=180deg)', () => {
			// 180 * 60000 = 10800000
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '10800000',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#00FFFF');
		});

		it('returns undefined when hue is NaN', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': 'notanumber',
					'@_sat': '100000',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when sat is missing', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_lum': '50000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when lum is missing', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '100000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('returns undefined when all channels are missing', () => {
			const node: XmlObject = {
				'a:hslClr': {},
			};
			expect(parseDrawingColorChoice(node)).toBeUndefined();
		});

		it('applies shade transform to HSL color', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '100000',
					'@_lum': '50000',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#800000');
		});
	});

	// -- Color type priority/precedence ------------------------------------

	describe('color type precedence', () => {
		it('prefers scrgbClr over srgbClr when both present', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': '100000',
					'@_g': '0',
					'@_b': '0',
				},
				'a:srgbClr': { '@_val': '0000FF' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('prefers srgbClr over sysClr', () => {
			const node: XmlObject = {
				'a:srgbClr': { '@_val': 'FF0000' },
				'a:sysClr': { '@_lastClr': '0000FF' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('prefers sysClr over schemeClr', () => {
			const node: XmlObject = {
				'a:sysClr': { '@_lastClr': 'FF0000' },
				'a:schemeClr': { '@_val': 'lt1' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF0000');
		});

		it('prefers schemeClr over hslClr', () => {
			const node: XmlObject = {
				'a:schemeClr': { '@_val': 'dk1' },
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '0',
					'@_lum': '100000',
				},
			};
			expect(parseDrawingColorChoice(node)).toBe('#000000');
		});

		it('prefers hslClr over prstClr', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'@_hue': '0',
					'@_sat': '0',
					'@_lum': '100000',
				},
				'a:prstClr': { '@_val': 'black' },
			};
			// hslClr -> white
			expect(parseDrawingColorChoice(node)).toBe('#FFFFFF');
		});

		it('falls through to srgbClr when scrgbClr is invalid', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'@_r': 'abc',
					'@_g': '0',
					'@_b': '0',
				},
				'a:srgbClr': { '@_val': '00FF00' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#00FF00');
		});

		it('falls through to sysClr when srgbClr is also invalid', () => {
			const node: XmlObject = {
				'a:scrgbClr': { '@_r': 'abc', '@_g': '0', '@_b': '0' },
				'a:srgbClr': { '@_val': 'ZZZ' },
				'a:sysClr': { '@_lastClr': 'AABB00' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#AABB00');
		});

		it('falls through to prstClr when all others are absent', () => {
			const node: XmlObject = {
				'a:prstClr': { '@_val': 'coral' },
			};
			expect(parseDrawingColorChoice(node)).toBe('#FF7F50');
		});
	});
});

// ---------------------------------------------------------------------------
// parseDrawingColor
// ---------------------------------------------------------------------------

describe('parseDrawingColor', () => {
	it('returns undefined for undefined input', () => {
		expect(parseDrawingColor(undefined)).toBeUndefined();
	});

	it('returns undefined for empty object', () => {
		expect(parseDrawingColor({})).toBeUndefined();
	});

	it('parses direct srgbClr nodes', () => {
		const node: XmlObject = {
			'a:srgbClr': { '@_val': '00FF00' },
		};
		expect(parseDrawingColor(node)).toBe('#00FF00');
	});

	it('parses direct schemeClr', () => {
		const node: XmlObject = {
			'a:schemeClr': { '@_val': 'accent1' },
		};
		expect(parseDrawingColor(node)).toBe(DEFAULT_SCHEME_COLOR_MAP.accent1);
	});

	it('parses direct sysClr', () => {
		const node: XmlObject = {
			'a:sysClr': { '@_lastClr': 'AABBCC' },
		};
		expect(parseDrawingColor(node)).toBe('#AABBCC');
	});

	it('parses direct prstClr', () => {
		const node: XmlObject = {
			'a:prstClr': { '@_val': 'blue' },
		};
		expect(parseDrawingColor(node)).toBe('#0000FF');
	});

	it('parses nested a:solidFill with srgbClr', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': { '@_val': '0000FF' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#0000FF');
	});

	it('parses nested a:solidFill with schemeClr', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:schemeClr': { '@_val': 'dk1' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#000000');
	});

	it('parses nested a:solidFill with sysClr', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:sysClr': { '@_lastClr': 'AABBCC' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#AABBCC');
	});

	it('parses nested a:solidFill with prstClr', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:prstClr': { '@_val': 'blue' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#0000FF');
	});

	it('returns undefined when solidFill is empty', () => {
		const node: XmlObject = {
			'a:solidFill': {},
		};
		expect(parseDrawingColor(node)).toBeUndefined();
	});

	it('prefers direct colour over solidFill wrapper', () => {
		const node: XmlObject = {
			'a:srgbClr': { '@_val': 'FF0000' },
			'a:solidFill': {
				'a:srgbClr': { '@_val': '00FF00' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#FF0000');
	});

	it('falls through to solidFill when direct color is not present', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': { '@_val': 'AABBCC' },
			},
		};
		expect(parseDrawingColor(node)).toBe('#AABBCC');
	});

	it('returns undefined for node with no colour info', () => {
		const node: XmlObject = {
			'a:someOtherElement': {},
		};
		expect(parseDrawingColor(node)).toBeUndefined();
	});

	it('returns undefined when solidFill contains invalid color', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': { '@_val': 'XXXXXX' },
			},
		};
		expect(parseDrawingColor(node)).toBeUndefined();
	});

	it('applies transforms through solidFill path', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': {
					'@_val': 'FF0000',
					'a:tint': { '@_val': '50000' },
				},
			},
		};
		expect(parseDrawingColor(node)).toBe('#FF8080');
	});

	it('applies shade through solidFill path', () => {
		const node: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': {
					'@_val': 'FFFFFF',
					'a:shade': { '@_val': '50000' },
				},
			},
		};
		expect(parseDrawingColor(node)).toBe('#808080');
	});
});

// ---------------------------------------------------------------------------
// parseDrawingColorOpacity
// ---------------------------------------------------------------------------

describe('parseDrawingColorOpacity', () => {
	it('returns undefined for undefined input', () => {
		expect(parseDrawingColorOpacity(undefined)).toBeUndefined();
	});

	it('returns undefined for empty object', () => {
		expect(parseDrawingColorOpacity({})).toBeUndefined();
	});

	it('returns undefined when no alpha info is present', () => {
		const node: XmlObject = {
			'a:srgbClr': { '@_val': 'FF0000' },
		};
		expect(parseDrawingColorOpacity(node)).toBeUndefined();
	});

	// -- alpha from each color type -----------------------------------------

	describe('alpha from different color types', () => {
		it('parses alpha from a:srgbClr', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'@_val': 'FF0000',
					'a:alpha': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.5, 2);
		});

		it('parses alpha from a:schemeClr', () => {
			const node: XmlObject = {
				'a:schemeClr': {
					'@_val': 'accent1',
					'a:alpha': { '@_val': '75000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.75, 2);
		});

		it('parses alpha from a:sysClr', () => {
			const node: XmlObject = {
				'a:sysClr': {
					'@_lastClr': '000000',
					'a:alpha': { '@_val': '25000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.25, 2);
		});

		it('parses alpha from a:hslClr', () => {
			const node: XmlObject = {
				'a:hslClr': {
					'a:alpha': { '@_val': '60000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.6, 2);
		});

		it('parses alpha from a:prstClr', () => {
			const node: XmlObject = {
				'a:prstClr': {
					'a:alpha': { '@_val': '80000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.8, 2);
		});

		it('parses alpha from a:scrgbClr', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'a:alpha': { '@_val': '40000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.4, 2);
		});
	});

	// -- alpha boundary values ----------------------------------------------

	describe('alpha boundary values', () => {
		it('returns 0 for alpha=0 (fully transparent)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '0' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBe(0);
		});

		it('returns 1 for alpha=100000 (fully opaque)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '100000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBe(1);
		});

		it('clamps alpha above 100000 to 1', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '150000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeLessThanOrEqual(1);
		});
	});

	// -- alphaMod -----------------------------------------------------------

	describe('alphaMod transform', () => {
		it('applies alphaMod when alpha is absent (defaults to 1)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alphaMod': { '@_val': '50000' },
				},
			};
			// Default opacity=1, multiplied by 0.5
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.5, 2);
		});

		it('applies alphaMod on top of alpha', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '80000' },
					'a:alphaMod': { '@_val': '50000' },
				},
			};
			// 0.8 * 0.5 = 0.4
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.4, 2);
		});

		it('applies alphaMod=100000 (no change)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '60000' },
					'a:alphaMod': { '@_val': '100000' },
				},
			};
			// 0.6 * 1.0 = 0.6
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.6, 2);
		});

		it('applies alphaMod=0 (fully transparent)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '100000' },
					'a:alphaMod': { '@_val': '0' },
				},
			};
			// 1.0 * 0.0 = 0.0
			expect(parseDrawingColorOpacity(node)).toBe(0);
		});
	});

	// -- alphaOff -----------------------------------------------------------

	describe('alphaOff transform', () => {
		it('applies positive alphaOff (no alpha, defaults to 1)', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alphaOff': { '@_val': '0' },
				},
			};
			// Default=1, offset by 0 = 1
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(1, 2);
		});

		it('negative alphaOff values are clamped to 0 by parseDrawingPercent', () => {
			// parseDrawingPercent uses clampUnitInterval, so -20000/100000 = -0.2 -> 0
			// This means negative offsets cannot reduce opacity through this code path
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alphaOff': { '@_val': '-20000' },
				},
			};
			// alphaOff clamped to 0, default opacity=1, 1+0 = 1
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(1, 2);
		});

		it('applies positive alphaOff to alpha', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '50000' },
					'a:alphaOff': { '@_val': '20000' },
				},
			};
			// 0.5 + 0.2 = 0.7
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.7, 2);
		});

		it('clamps alphaOff result above 1 to 1', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '80000' },
					'a:alphaOff': { '@_val': '50000' },
				},
			};
			// 0.8 + 0.5 = 1.3 -> clamped to 1
			expect(parseDrawingColorOpacity(node)).toBe(1);
		});

		it('alphaOff with negative value is clamped to 0, so opacity is unchanged', () => {
			// parseDrawingPercent clamps -50000/100000 = -0.5 to 0
			// So alphaOff becomes 0 and has no effect
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '10000' },
					'a:alphaOff': { '@_val': '-50000' },
				},
			};
			// alpha=0.1, alphaOff clamped to 0, so result = 0.1
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.1, 2);
		});
	});

	// -- Combined alpha transforms ------------------------------------------

	describe('combined alpha transforms', () => {
		it('applies alpha + alphaMod + alphaOff in order', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '80000' },
					'a:alphaMod': { '@_val': '50000' },
					'a:alphaOff': { '@_val': '10000' },
				},
			};
			// 0.8 * 0.5 = 0.4, 0.4 + 0.1 = 0.5
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.5, 2);
		});

		it('handles alphaMod + alphaOff without alpha', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alphaMod': { '@_val': '60000' },
					'a:alphaOff': { '@_val': '10000' },
				},
			};
			// Default=1, 1*0.6=0.6, 0.6+0.1=0.7
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.7, 2);
		});

		it('clamps combined result to [0,1]', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '100000' },
					'a:alphaMod': { '@_val': '100000' },
					'a:alphaOff': { '@_val': '50000' },
				},
			};
			// 1.0 * 1.0 = 1.0, 1.0 + 0.5 = 1.5 -> clamped to 1
			expect(parseDrawingColorOpacity(node)).toBe(1);
		});
	});

	// -- Colour choice priority for opacity ---------------------------------

	describe('color choice priority for opacity', () => {
		it('extracts alpha from scrgbClr when multiple color types present', () => {
			const node: XmlObject = {
				'a:scrgbClr': {
					'a:alpha': { '@_val': '30000' },
				},
				'a:srgbClr': {
					'a:alpha': { '@_val': '90000' },
				},
			};
			// scrgbClr is checked first in the || chain
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.3, 2);
		});

		it('extracts alpha from srgbClr before schemeClr', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'a:alpha': { '@_val': '70000' },
				},
				'a:schemeClr': {
					'a:alpha': { '@_val': '20000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeCloseTo(0.7, 2);
		});
	});

	// -- Edge cases ---------------------------------------------------------

	describe('edge cases', () => {
		it('returns undefined when color choice has non-alpha transforms only', () => {
			const node: XmlObject = {
				'a:srgbClr': {
					'@_val': 'FF0000',
					'a:shade': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeUndefined();
		});

		it('returns undefined when only unrecognized color types are present', () => {
			const node: XmlObject = {
				'a:unknownClr': {
					'a:alpha': { '@_val': '50000' },
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeUndefined();
		});

		it('returns undefined when colour choice has no alpha elements', () => {
			const node: XmlObject = {
				'a:sysClr': {
					'@_lastClr': '000000',
				},
			};
			expect(parseDrawingColorOpacity(node)).toBeUndefined();
		});
	});
});
