import { describe, it, expect } from 'vitest';

import {
	getEffectDagCssFilter,
	getEffectDagFilter,
	getEffectDagOpacity,
	getEffectDagBlendMode,
	getDuotoneSvgFilterMarkup,
	hasEffectDagProperties,
} from './visual-effects';

// Ported from the React `effect-dag-filters.test.ts` (now a thin shim over this
// module). Exercises the effect-DAG → CSS-filter mapping, opacity/blend
// extraction, the standalone duotone SVG-markup builder, and DAG-presence
// detection.

describe('getEffectDagCssFilter', () => {
	it('returns undefined for undefined style', () => {
		expect(getEffectDagCssFilter(undefined)).toBeUndefined();
	});

	it('returns undefined for empty style', () => {
		expect(getEffectDagCssFilter({})).toBeUndefined();
	});

	it('maps dagGrayscale to grayscale(1)', () => {
		expect(getEffectDagCssFilter({ dagGrayscale: true })).toBe('grayscale(1)');
	});

	it('does not apply grayscale when dagGrayscale is false', () => {
		expect(getEffectDagCssFilter({ dagGrayscale: false })).toBeUndefined();
	});

	it('maps dagBiLevel > 50 to contrast(1000)', () => {
		expect(getEffectDagCssFilter({ dagBiLevel: 75 })).toBe('contrast(1000)');
	});

	it('maps dagBiLevel <= 50 to contrast(0.01)', () => {
		expect(getEffectDagCssFilter({ dagBiLevel: 50 })).toBe('contrast(0.01)');
	});

	it('clamps dagBiLevel to 0-100 before threshold check', () => {
		expect(getEffectDagCssFilter({ dagBiLevel: 150 })).toBe('contrast(1000)');
	});

	it('maps dagLumBrightness to brightness()', () => {
		expect(getEffectDagCssFilter({ dagLumBrightness: 30 })).toBe('brightness(1.3)');
	});

	it('maps negative dagLumBrightness to brightness()', () => {
		expect(getEffectDagCssFilter({ dagLumBrightness: -50 })).toBe('brightness(0.5)');
	});

	it('ignores dagLumBrightness of 0', () => {
		expect(getEffectDagCssFilter({ dagLumBrightness: 0 })).toBeUndefined();
	});

	it('maps dagLumContrast to contrast()', () => {
		expect(getEffectDagCssFilter({ dagLumContrast: 40 })).toBe('contrast(1.4)');
	});

	it('combines dagLumBrightness and dagLumContrast', () => {
		expect(getEffectDagCssFilter({ dagLumBrightness: 20, dagLumContrast: -10 })).toBe(
			'brightness(1.2) contrast(0.9)',
		);
	});

	it('maps dagHslHue to hue-rotate()', () => {
		expect(getEffectDagCssFilter({ dagHslHue: 180 })).toBe('hue-rotate(180deg)');
	});

	it('maps dagHslSaturation to saturate()', () => {
		expect(getEffectDagCssFilter({ dagHslSaturation: 200 })).toBe('saturate(2)');
	});

	it('maps dagHslSaturation of 0 to saturate(0)', () => {
		expect(getEffectDagCssFilter({ dagHslSaturation: 0 })).toBe('saturate(0)');
	});

	it('ignores dagHslSaturation of 100 (neutral)', () => {
		expect(getEffectDagCssFilter({ dagHslSaturation: 100 })).toBeUndefined();
	});

	it('maps dagHslLuminance to brightness() approximation', () => {
		expect(getEffectDagCssFilter({ dagHslLuminance: 50 })).toBe('brightness(1.5)');
	});

	it('maps dagAlphaModFix to opacity()', () => {
		expect(getEffectDagCssFilter({ dagAlphaModFix: 75 })).toBe('opacity(0.75)');
	});

	it('maps dagTintHue and dagTintAmount to sepia() hue-rotate()', () => {
		expect(getEffectDagCssFilter({ dagTintHue: 45, dagTintAmount: 80 })).toBe(
			'sepia(0.8) hue-rotate(45deg)',
		);
	});

	it('uses default amount of 50 when only dagTintHue is set', () => {
		expect(getEffectDagCssFilter({ dagTintHue: 90 })).toBe('sepia(0.5) hue-rotate(90deg)');
	});

	it('clamps dagTintAmount to 0-100 range', () => {
		expect(getEffectDagCssFilter({ dagTintAmount: 150, dagTintHue: 0 })).toBe(
			'sepia(1) hue-rotate(0deg)',
		);
	});

	it('maps dagDuotone to url() reference when elementId is provided', () => {
		expect(
			getEffectDagCssFilter({ dagDuotone: { color1: '#000000', color2: '#FFFFFF' } }, 'el-123'),
		).toBe('url(#dag-duotone-el-123)');
	});

	it('omits dagDuotone when no elementId is provided', () => {
		expect(
			getEffectDagCssFilter({ dagDuotone: { color1: '#000000', color2: '#FFFFFF' } }),
		).toBeUndefined();
	});

	it('combines multiple DAG effects into a single filter string', () => {
		expect(
			getEffectDagCssFilter({
				dagGrayscale: true,
				dagLumBrightness: 10,
				dagHslHue: 90,
				dagAlphaModFix: 80,
			}),
		).toBe('grayscale(1) brightness(1.1) hue-rotate(90deg) opacity(0.8)');
	});

	it('legacy getEffectDagFilter is an alias for getEffectDagCssFilter', () => {
		expect(getEffectDagFilter).toBe(getEffectDagCssFilter);
	});
});

describe('getEffectDagOpacity', () => {
	it('returns undefined for undefined style', () => {
		expect(getEffectDagOpacity(undefined)).toBeUndefined();
	});

	it('returns undefined when dagAlphaModFix is not set', () => {
		expect(getEffectDagOpacity({})).toBeUndefined();
	});

	it('returns normalised 0-1 opacity from dagAlphaModFix', () => {
		expect(getEffectDagOpacity({ dagAlphaModFix: 50 })).toBe(0.5);
	});

	it('clamps opacity to max 1', () => {
		expect(getEffectDagOpacity({ dagAlphaModFix: 200 })).toBe(1);
	});

	it('clamps opacity to min 0', () => {
		expect(getEffectDagOpacity({ dagAlphaModFix: -50 })).toBe(0);
	});
});

describe('getEffectDagBlendMode', () => {
	it('returns undefined for undefined blend', () => {
		expect(getEffectDagBlendMode(undefined)).toBeUndefined();
	});

	it('maps "mult" to "multiply"', () => {
		expect(getEffectDagBlendMode('mult')).toBe('multiply');
	});

	it('maps "screen" to "screen"', () => {
		expect(getEffectDagBlendMode('screen')).toBe('screen');
	});

	it('maps "darken" to "darken"', () => {
		expect(getEffectDagBlendMode('darken')).toBe('darken');
	});

	it('maps "lighten" to "lighten"', () => {
		expect(getEffectDagBlendMode('lighten')).toBe('lighten');
	});

	it('returns undefined for "over" (normal blending)', () => {
		expect(getEffectDagBlendMode('over')).toBeUndefined();
	});
});

describe('getDuotoneSvgFilterMarkup', () => {
	it('generates valid SVG filter markup', () => {
		const markup = getDuotoneSvgFilterMarkup('test-filter', '#000000', '#FFFFFF');
		expect(markup).toContain('id="test-filter"');
		expect(markup).toContain('feColorMatrix');
		expect(markup).toContain('feComponentTransfer');
		expect(markup).toContain('feFuncR');
		expect(markup).toContain('feFuncG');
		expect(markup).toContain('feFuncB');
	});

	it('computes correct slopes for black-to-white mapping', () => {
		const markup = getDuotoneSvgFilterMarkup('bw', '#000000', '#FFFFFF');
		expect(markup).toContain('slope="1"');
		expect(markup).toContain('intercept="0"');
	});

	it('wraps the filter in a hidden svg element', () => {
		const markup = getDuotoneSvgFilterMarkup('custom', '#800000', '#FFFFFF');
		expect(markup).toContain('feFuncR');
		expect(markup).toMatch(/<svg.*<\/svg>/u);
	});

	it('uses BT.709 luminance weights in grayscale matrix', () => {
		const markup = getDuotoneSvgFilterMarkup('lum', '#000000', '#FFFFFF');
		expect(markup).toContain('0.2126');
		expect(markup).toContain('0.7152');
		expect(markup).toContain('0.0722');
	});

	it('generates zero slopes for identical shadow and highlight', () => {
		const markup = getDuotoneSvgFilterMarkup('mono', '#808080', '#808080');
		expect(markup).toContain('slope="0"');
	});
});

describe('hasEffectDagProperties', () => {
	it('returns false for undefined style', () => {
		expect(hasEffectDagProperties(undefined)).toBeFalsy();
	});

	it('returns false for empty style', () => {
		expect(hasEffectDagProperties({})).toBeFalsy();
	});

	it('returns true when dagGrayscale is set', () => {
		expect(hasEffectDagProperties({ dagGrayscale: true })).toBeTruthy();
	});

	it('returns true when dagBiLevel is set', () => {
		expect(hasEffectDagProperties({ dagBiLevel: 50 })).toBeTruthy();
	});

	it('returns true when dagDuotone is set', () => {
		expect(hasEffectDagProperties({ dagDuotone: { color1: '#000', color2: '#fff' } })).toBeTruthy();
	});

	it('returns true when dagFillOverlayBlend is set', () => {
		expect(hasEffectDagProperties({ dagFillOverlayBlend: 'mult' })).toBeTruthy();
	});

	it('returns true when dagTintAmount is set', () => {
		expect(hasEffectDagProperties({ dagTintAmount: 60 })).toBeTruthy();
	});

	it('returns false when only non-DAG properties are set', () => {
		expect(
			hasEffectDagProperties({ fillColor: '#FF0000', strokeWidth: 2, shadowBlur: 5 }),
		).toBeFalsy();
	});
});
