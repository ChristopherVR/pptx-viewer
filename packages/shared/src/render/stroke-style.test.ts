import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getComputedStrokeStyle } from './stroke-style';

/**
 * The shared `a:ln` -> CSS outline decision. These assert the four things the
 * per-binding copies each got wrong: compound lines, the miter limit, the
 * stroke alpha, and "a width-only fill-less line paints nothing".
 */
function shape(style: Partial<ShapeStyle>, overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'sp1',
		type: 'shape',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: style,
		...overrides,
	} as unknown as PptxElement;
}

describe('getComputedStrokeStyle', () => {
	it('paints an ordinary solid line at its authored width and colour', () => {
		const stroke = getComputedStrokeStyle(shape({ strokeWidth: 3, strokeColor: '#ff0000' }));
		expect(stroke.borderWidth).toBe(3);
		expect(stroke.borderStyle).toBe('solid');
		expect(stroke.borderColor).toBe('#ff0000');
		expect(stroke.border).toBe('3px solid #ff0000');
	});

	it('maps the dash type onto a CSS border style', () => {
		expect(
			getComputedStrokeStyle(
				shape({ strokeWidth: 1, strokeColor: '#000000', strokeDash: 'sysDot' }),
			).borderStyle,
		).toBe('dotted');
		expect(
			getComputedStrokeStyle(
				shape({ strokeWidth: 1, strokeColor: '#000000', strokeDash: 'lgDash' }),
			).borderStyle,
		).toBe('dashed');
	});

	// `a:ln/@cmpd`: `border-style: double` is the only CSS style that paints more
	// than one strand, and it splits the FULL border width between them.
	it('paints a compound line as full-width `double`', () => {
		for (const compoundLine of ['dbl', 'thickThin', 'thinThick', 'tri'] as const) {
			const stroke = getComputedStrokeStyle(
				shape({ strokeWidth: 9, strokeColor: '#000000', compoundLine, strokeDash: 'dash' }),
			);
			expect(stroke.borderStyle).toBe('double');
			expect(stroke.borderWidth).toBe(9);
		}
	});

	it('leaves a single (`sng`) compound value on the dash style', () => {
		const stroke = getComputedStrokeStyle(
			shape({ strokeWidth: 2, strokeColor: '#000000', compoundLine: 'sng', strokeDash: 'dot' }),
		);
		expect(stroke.borderStyle).toBe('dotted');
	});

	// `a:miter/@lim` is ST_PositivePercentage (1000ths of a percent).
	it('converts the miter limit to an SVG ratio, gated on a mitred join', () => {
		expect(
			getComputedStrokeStyle(
				shape({ strokeWidth: 2, strokeColor: '#000000', lineJoin: 'miter', miterLimit: 800000 }),
			).strokeMiterlimit,
		).toBe(8);
		// Below 1 is invalid for SVG, so it clamps rather than emitting it.
		expect(
			getComputedStrokeStyle(
				shape({ strokeWidth: 2, strokeColor: '#000000', lineJoin: 'miter', miterLimit: 50000 }),
			).strokeMiterlimit,
		).toBe(1);
		expect(
			getComputedStrokeStyle(
				shape({ strokeWidth: 2, strokeColor: '#000000', lineJoin: 'round', miterLimit: 800000 }),
			).strokeMiterlimit,
		).toBeUndefined();
	});

	it('maps the join and cap onto their SVG presentation values', () => {
		const stroke = getComputedStrokeStyle(
			shape({ strokeWidth: 2, strokeColor: '#000000', lineJoin: 'bevel', lineCap: 'sq' }),
		);
		expect(stroke.strokeLinejoin).toBe('bevel');
		expect(stroke.strokeLinecap).toBe('square');
	});

	it('folds `strokeOpacity` into the colour, and otherwise leaves it verbatim', () => {
		expect(
			getComputedStrokeStyle(shape({ strokeWidth: 2, strokeColor: '#ff0000', strokeOpacity: 0.5 }))
				.borderColor,
		).toBe('rgba(255, 0, 0, 0.5)');
		// A short hex is legal CSS and must not be rewritten to the default.
		expect(getComputedStrokeStyle(shape({ strokeWidth: 2, strokeColor: '#000' })).borderColor).toBe(
			'#000',
		);
	});

	it('paints nothing for a width-only, fill-less line', () => {
		// `<a:ln w="12700"><a:miter/></a:ln>`: no fill child, so PowerPoint paints
		// no outline at all (the frameless pictures of the real-world media deck).
		const stroke = getComputedStrokeStyle(shape({ strokeWidth: 2 }));
		expect(stroke.borderWidth).toBe(0);
		expect(stroke.border).toBeUndefined();
	});

	it('paints nothing when the stroke overlay owns the outline', () => {
		// An open ("stroke only") preset has no box to put a border on: the
		// stroked SVG overlay paints it, so a border here would draw a rectangle.
		const line = shape({ strokeWidth: 2, strokeColor: '#000000' }, { shapeType: 'line' });
		expect(getComputedStrokeStyle(line).borderWidth).toBe(0);
	});

	it('returns the empty decision for an element with no shape properties', () => {
		const stroke = getComputedStrokeStyle({ id: 't', type: 'table' } as unknown as PptxElement);
		expect(stroke.borderWidth).toBe(0);
		expect(stroke.borderStyle).toBeUndefined();
	});
});
