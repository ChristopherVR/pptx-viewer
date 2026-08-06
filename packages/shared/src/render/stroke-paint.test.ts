import { describe, expect, it } from 'vitest';

import { hasStrokePaint, paintedStrokeWidth } from './stroke-paint';

describe('hasStrokePaint', () => {
	it('is false for a width-only fill-less line (PowerPoint paints no frame)', () => {
		// <a:ln w="12700"><a:miter lim="400000"/></a:ln> with no p:style/lnRef:
		// core parses width + join only, no colour and no fill mode.
		expect(hasStrokePaint({ strokeWidth: 1.333 })).toBeFalsy();
	});

	it('is false without a style or without a width', () => {
		expect(hasStrokePaint(undefined)).toBeFalsy();
		expect(hasStrokePaint({ strokeColor: '#FF0000' })).toBeFalsy();
		expect(hasStrokePaint({ strokeWidth: 0, strokeColor: '#FF0000' })).toBeFalsy();
		expect(hasStrokePaint({ strokeWidth: -2, strokeColor: '#FF0000' })).toBeFalsy();
	});

	it('is true when the line carries an explicit colour', () => {
		expect(hasStrokePaint({ strokeWidth: 2, strokeColor: '#FF0000' })).toBeTruthy();
	});

	it('is true for an explicit noFill too (parsed as transparent, width forced to 0 upstream)', () => {
		// Core turns <a:noFill/> into strokeWidth 0 + strokeColor 'transparent';
		// the width gate is what suppresses it, not the colour check.
		expect(hasStrokePaint({ strokeWidth: 0, strokeColor: 'transparent' })).toBeFalsy();
	});

	it('is true when only a gradient/pattern fill mode marks the fill source', () => {
		expect(hasStrokePaint({ strokeWidth: 2, strokeFillMode: 'gradient' })).toBeTruthy();
	});
});

describe('paintedStrokeWidth', () => {
	it('returns the parsed width for a painted line', () => {
		expect(paintedStrokeWidth({ strokeWidth: 1.333, strokeColor: '#1F2937' })).toBe(1.333);
	});

	it('returns 0 for a width-only fill-less line', () => {
		expect(paintedStrokeWidth({ strokeWidth: 1.333 })).toBe(0);
	});

	it('returns 0 for no style at all', () => {
		expect(paintedStrokeWidth(undefined)).toBe(0);
	});
});
