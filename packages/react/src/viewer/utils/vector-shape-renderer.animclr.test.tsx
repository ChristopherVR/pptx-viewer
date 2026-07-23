import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderVectorShape } from './vector-shape-renderer';

/**
 * `p:animClr` fill/stroke recolor: when a colour animation targets a shape's
 * fill / stroke, the painted SVG vector must use `fill: inherit` / `stroke:
 * inherit` so the wrapper-level colour keyframes cascade into the vector.
 * Without the flags the exact static paint is kept (no regression).
 */

function customGeometryShape(): PptxElement {
	return {
		id: 'cg1',
		type: 'shape',
		shapeType: 'rect',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		pathData: 'M0 0 L10 0 L10 10 Z',
		pathWidth: 10,
		pathHeight: 10,
		shapeStyle: {},
	} as unknown as PptxElement;
}

function cylinderShape(): PptxElement {
	return {
		id: 'cyl1',
		type: 'shape',
		shapeType: 'cylinder',
		x: 0,
		y: 0,
		width: 20,
		height: 40,
		shapeStyle: {},
	} as unknown as PptxElement;
}

function markup(element: PptxElement, animatesFill?: boolean, animatesStroke?: boolean): string {
	const node = renderVectorShape(
		element,
		true,
		'#ff0000',
		2,
		'#0000ff',
		animatesFill,
		animatesStroke,
	);
	return renderToStaticMarkup(node);
}

describe('renderVectorShape p:animClr fill/stroke recolor (custom geometry)', () => {
	it('keeps the static fill paint when no fill animation is active', () => {
		const html = markup(customGeometryShape());
		expect(html).not.toContain('fill="inherit"');
		expect(html.toLowerCase()).toContain('#ff0000');
	});

	it('paints the fill with inherit when a fill animation is active', () => {
		const html = markup(customGeometryShape(), true, false);
		expect(html).toContain('fill="inherit"');
	});

	it('keeps the static stroke paint when no stroke animation is active', () => {
		const html = markup(customGeometryShape());
		expect(html).not.toContain('stroke="inherit"');
		expect(html.toLowerCase()).toContain('#0000ff');
	});

	it('paints the stroke with inherit when a stroke animation is active', () => {
		const html = markup(customGeometryShape(), false, true);
		expect(html).toContain('stroke="inherit"');
	});

	it('does not touch the stroke when only the fill is animated', () => {
		const html = markup(customGeometryShape(), true, false);
		expect(html).not.toContain('stroke="inherit"');
		expect(html.toLowerCase()).toContain('#0000ff');
	});
});

describe('renderVectorShape p:animClr fill/stroke recolor (cylinder preset)', () => {
	it('keeps static fill/stroke without animation flags', () => {
		const html = markup(cylinderShape());
		expect(html).not.toContain('fill="inherit"');
		expect(html).not.toContain('stroke="inherit"');
	});

	it('paints fill and stroke with inherit when both are animated', () => {
		const html = markup(cylinderShape(), true, true);
		expect(html).toContain('fill="inherit"');
		expect(html).toContain('stroke="inherit"');
	});
});
