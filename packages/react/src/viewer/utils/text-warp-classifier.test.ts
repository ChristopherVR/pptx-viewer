import { describe, expect, it } from 'vitest';

import {
	getWarpCategory,
	getEnvelopeCssTransform,
	getSimpleCssTransform,
	ALL_CLASSIFIED_PRESETS,
} from './text-warp-classifier';

// ── All 40+ known OOXML text warp presets ─────────────────────────────
const ALL_KNOWN_PRESETS = [
	'textNoShape',
	'textPlain',
	'textStop',
	'textTriangle',
	'textTriangleInverted',
	'textChevron',
	'textChevronInverted',
	'textRingInside',
	'textRingOutside',
	'textArchUp',
	'textArchDown',
	'textCircle',
	'textButton',
	'textArchUpPour',
	'textArchDownPour',
	'textCirclePour',
	'textButtonPour',
	'textCurveUp',
	'textCurveDown',
	'textCanUp',
	'textCanDown',
	'textWave1',
	'textWave2',
	'textWave4',
	'textDoubleWave1',
	'textInflate',
	'textDeflate',
	'textInflateBottom',
	'textDeflateBottom',
	'textInflateTop',
	'textDeflateTop',
	'textFadeRight',
	'textFadeLeft',
	'textFadeUp',
	'textFadeDown',
	'textSlantUp',
	'textSlantDown',
	'textCascadeUp',
	'textCascadeDown',
	'textDeflateInflate',
	'textDeflateInflateDeflate',
];

describe('text-warp-classifier', () => {
	describe('getWarpCategory', () => {
		it('returns "none" for textNoShape', () => {
			expect(getWarpCategory('textNoShape')).toBe('none');
		});

		it('returns "none" for textPlain', () => {
			expect(getWarpCategory('textPlain')).toBe('none');
		});

		it('returns "none" for undefined preset', () => {
			expect(getWarpCategory(undefined)).toBe('none');
		});

		it('returns "none" for empty string', () => {
			expect(getWarpCategory('')).toBe('none');
		});

		it('returns "path" for textArchUp', () => {
			expect(getWarpCategory('textArchUp')).toBe('path');
		});

		it('returns "path" for textCircle', () => {
			expect(getWarpCategory('textCircle')).toBe('path');
		});

		it('returns "path" for textWave1', () => {
			expect(getWarpCategory('textWave1')).toBe('path');
		});

		it('returns "path" for textCurveUp', () => {
			expect(getWarpCategory('textCurveUp')).toBe('path');
		});

		it('returns "envelope" for textInflate', () => {
			expect(getWarpCategory('textInflate')).toBe('envelope');
		});

		it('returns "envelope" for textDeflate', () => {
			expect(getWarpCategory('textDeflate')).toBe('envelope');
		});

		it('returns "envelope" for textCanUp', () => {
			expect(getWarpCategory('textCanUp')).toBe('envelope');
		});

		it('returns "envelope" for textDeflateInflate', () => {
			expect(getWarpCategory('textDeflateInflate')).toBe('envelope');
		});

		it('returns "simple" for textSlantUp', () => {
			expect(getWarpCategory('textSlantUp')).toBe('simple');
		});

		it('returns "simple" for textFadeRight', () => {
			expect(getWarpCategory('textFadeRight')).toBe('simple');
		});

		it('returns "simple" for textCascadeDown', () => {
			expect(getWarpCategory('textCascadeDown')).toBe('simple');
		});

		it('returns "none" for unknown presets', () => {
			expect(getWarpCategory('textUnknownFuture')).toBe('none');
		});

		it('classifies all 40+ known presets (no unknowns fall through)', () => {
			const categorized = ALL_KNOWN_PRESETS.filter((p) => ALL_CLASSIFIED_PRESETS.has(p));
			expect(categorized).toHaveLength(ALL_KNOWN_PRESETS.length);
		});

		it('covers every known preset with a non-undefined category', () => {
			for (const preset of ALL_KNOWN_PRESETS) {
				const cat = getWarpCategory(preset);
				expect(['path', 'envelope', 'simple', 'none']).toContain(cat);
			}
		});
	});

	describe('getEnvelopeCssTransform', () => {
		it('textInflate generates scaleX/scaleY transform', () => {
			const style = getEnvelopeCssTransform('textInflate');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('scaleY');
			expect(style.transform).toContain('scaleX');
		});

		it('textDeflate generates scaleX/scaleY with reduced values', () => {
			const style = getEnvelopeCssTransform('textDeflate');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('scaleY');
			// Deflate should shrink, so scaleY < 1
			const match = style.transform!.match(/scaleY\(([^)]+)\)/);
			expect(match).not.toBeNull();
			expect(Number.parseFloat(match![1])).toBeLessThan(1);
		});

		it('textCanUp generates perspective + rotateX transform', () => {
			const style = getEnvelopeCssTransform('textCanUp');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('perspective');
			expect(style.transform).toContain('rotateX');
		});

		it('textCanDown generates perspective + rotateX transform', () => {
			const style = getEnvelopeCssTransform('textCanDown');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('perspective');
			expect(style.transform).toContain('rotateX');
		});

		it('uses default adjustment values when not provided', () => {
			const styleDefault = getEnvelopeCssTransform('textInflate');
			const styleExplicit = getEnvelopeCssTransform('textInflate', 18750);
			// With the default adj1 (18750), both should produce identical output
			expect(styleDefault.transform).toBe(styleExplicit.transform);
		});

		it('adjustment values modify the transform intensity', () => {
			const styleSmall = getEnvelopeCssTransform('textInflate', 9375); // half default
			const styleLarge = getEnvelopeCssTransform('textInflate', 37500); // double default
			// Different adj1 values should produce different transforms
			expect(styleSmall.transform).not.toBe(styleLarge.transform);
		});

		it('textInflateBottom applies perspective from bottom origin', () => {
			const style = getEnvelopeCssTransform('textInflateBottom');
			expect(style.transform).toContain('perspective');
			expect(style.transformOrigin).toBe('center bottom');
		});

		it('textDeflateInflateDeflate applies compound scale', () => {
			const style = getEnvelopeCssTransform('textDeflateInflateDeflate');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('scaleY');
			expect(style.transform).toContain('scaleX');
		});

		it('returns empty object for unknown preset', () => {
			const style = getEnvelopeCssTransform('textUnknown');
			expect(style).toStrictEqual({});
		});
	});

	describe('getSimpleCssTransform', () => {
		it('textSlantUp contains skewY', () => {
			const style = getSimpleCssTransform('textSlantUp');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('skewY');
		});

		it('textSlantDown contains skewY with positive value', () => {
			const style = getSimpleCssTransform('textSlantDown');
			expect(style.transform).toBeDefined();
			expect(style.transform).toContain('skewY');
			// SlantDown should skew positively
			const match = style.transform!.match(/skewY\(([^)]+)deg\)/);
			expect(match).not.toBeNull();
			expect(Number.parseFloat(match![1])).toBeGreaterThan(0);
		});

		it('textFadeRight contains perspective + rotateY', () => {
			const style = getSimpleCssTransform('textFadeRight');
			expect(style.transform).toContain('perspective');
			expect(style.transform).toContain('rotateY');
		});

		it('textFadeUp contains perspective + rotateX', () => {
			const style = getSimpleCssTransform('textFadeUp');
			expect(style.transform).toContain('perspective');
			expect(style.transform).toContain('rotateX');
		});

		it('textCascadeUp contains skewY with negative value', () => {
			const style = getSimpleCssTransform('textCascadeUp');
			expect(style.transform).toContain('skewY');
			const match = style.transform!.match(/skewY\(([^)]+)deg\)/);
			expect(match).not.toBeNull();
			expect(Number.parseFloat(match![1])).toBeLessThan(0);
		});

		it('textCascadeDown contains skewY with positive value', () => {
			const style = getSimpleCssTransform('textCascadeDown');
			expect(style.transform).toContain('skewY');
			const match = style.transform!.match(/skewY\(([^)]+)deg\)/);
			expect(match).not.toBeNull();
			expect(Number.parseFloat(match![1])).toBeGreaterThan(0);
		});

		it('uses default adjustment values when not provided', () => {
			const styleDefault = getSimpleCssTransform('textSlantUp');
			const styleExplicit = getSimpleCssTransform('textSlantUp', 55000);
			expect(styleDefault.transform).toBe(styleExplicit.transform);
		});

		it('adjustment values modify the transform', () => {
			const styleSmall = getSimpleCssTransform('textSlantUp', 27500); // half default
			const styleLarge = getSimpleCssTransform('textSlantUp', 110000); // double default
			expect(styleSmall.transform).not.toBe(styleLarge.transform);
		});

		it('textFadeLeft has right-side transform origin', () => {
			const style = getSimpleCssTransform('textFadeLeft');
			expect(style.transformOrigin).toBe('right center');
		});

		it('returns empty object for unknown preset', () => {
			const style = getSimpleCssTransform('textUnknown');
			expect(style).toStrictEqual({});
		});
	});
});
