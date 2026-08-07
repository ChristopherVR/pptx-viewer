import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildHollowHitOutline, isHollowShapeElement } from './hollow-shape-hit-test';

function shape(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'e1',
		type: 'shape',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		shapeStyle: {},
		...overrides,
	} as unknown as PptxElement;
}

describe('isHollowShapeElement', () => {
	it('treats an unfilled, textless shape as hollow', () => {
		// The slide-5 case: a `<a:noFill/>` panel frame drawn over a chart. On the
		// web a transparent background still hit-tests its whole box, so the frame
		// swallowed every click meant for the chart underneath it.
		expect(isHollowShapeElement(shape())).toBeTruthy();
	});

	it.each([
		['a solid fill', { fillColor: '#ff0000' }],
		['a gradient fill', { fillMode: 'gradient' }],
		['a pattern fill', { fillMode: 'pattern' }],
		['an image fill', { fillMode: 'image' }],
		['an inherited group fill', { fillMode: 'group' }],
	])('does not treat %s as hollow', (_label, shapeStyle) => {
		expect(isHollowShapeElement(shape({ shapeStyle }))).toBeFalsy();
	});

	it('does not treat an explicitly transparent fill as painted', () => {
		expect(isHollowShapeElement(shape({ shapeStyle: { fillColor: 'transparent' } }))).toBeTruthy();
	});

	it('leaves a shape that carries text alone', () => {
		// Deliberately narrow: an unfilled TEXT box is outline-only in PowerPoint
		// too, but its text must stay clickable, so it is out of scope here.
		const withText = shape({ text: 'hello' });
		expect(isHollowShapeElement(withText)).toBeFalsy();
	});

	it('ignores non-shape elements', () => {
		expect(isHollowShapeElement(shape({ type: 'image' }))).toBeFalsy();
	});
});

describe('buildHollowHitOutline', () => {
	it('returns an outline band for a hollow shape', () => {
		const outline = buildHollowHitOutline(shape());
		expect(outline).toBeDefined();
		expect(outline?.d).toContain('M');
		// A hairline frame still needs a finger-sized target.
		expect(outline?.strokeWidth).toBe(10);
	});

	it('scales the band with a thick stroke', () => {
		const outline = buildHollowHitOutline(shape({ shapeStyle: { strokeWidth: 6 } }));
		expect(outline?.strokeWidth).toBe(18);
	});

	it('returns undefined for a filled shape, so its box hit-tests normally', () => {
		expect(buildHollowHitOutline(shape({ shapeStyle: { fillColor: '#abc' } }))).toBeUndefined();
	});
});
