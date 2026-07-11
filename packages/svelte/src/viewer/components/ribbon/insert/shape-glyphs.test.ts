import { describe, expect, it } from 'vitest';

import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from './shape-glyphs';

describe('shape-glyphs shapeGlyphPath', () => {
	it('returns a non-empty path for every catalogue glyph', () => {
		for (const glyph of [
			'square',
			'circle',
			'database',
			'diamond',
			'minus',
			'moveRight',
			'plus',
			'triangle',
		] as const) {
			expect(shapeGlyphPath(glyph).length).toBeGreaterThan(0);
		}
	});
});

describe('shape-glyphs isStrokeGlyph', () => {
	it('flags line-like glyphs as stroke-only', () => {
		expect(isStrokeGlyph('minus')).toBeTruthy();
		expect(isStrokeGlyph('moveRight')).toBeTruthy();
		expect(isStrokeGlyph('plus')).toBeTruthy();
		expect(isStrokeGlyph('square')).toBeFalsy();
	});
});

describe('shape-glyphs glyphClassToTransform', () => {
	it('maps every catalogue glyphClass token to a CSS transform', () => {
		expect(glyphClassToTransform('')).toBe('none');
		expect(glyphClassToTransform('rotate-180')).toBe('rotate(180deg)');
		expect(glyphClassToTransform('-rotate-90')).toBe('rotate(-90deg)');
		expect(glyphClassToTransform('rotate-90')).toBe('rotate(90deg)');
		expect(glyphClassToTransform('-skew-x-12')).toBe('skewX(-12deg)');
		expect(glyphClassToTransform('rotate-45')).toBe('rotate(45deg)');
	});
});
