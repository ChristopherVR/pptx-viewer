import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderVectorShape } from './vector-shape-renderer';

/**
 * issue #132 - "gradient fill renders as solid colour".
 *
 * A freeform (`a:custGeom`) is the one shape React does NOT paint as an HTML box:
 * `getShapeVisualStyle` suppresses the container fill and `renderVectorShape`
 * emits a real SVG `<path>` instead, because a rectangular background would flood
 * the whole bounding box. An SVG `fill` attribute cannot take a CSS gradient, so
 * the renderer fell back to the parser's *representative* solid colour - every
 * fade flattened to one block and any transparent stop became opaque.
 *
 * The gradient now goes through an SVG paint server built by shared
 * `buildSvgGradientDef`. The four other bindings paint custom geometry as a
 * clipped background image and were never affected.
 */

function freeform(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		id: 'ppt/slides/slide3.xml-shape-9',
		type: 'shape',
		shapeType: 'custom',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		pathData: 'M 0 0 L 100 0 L 100 50 Z',
		pathWidth: 100,
		pathHeight: 50,
		shapeStyle,
	} as unknown as PptxElement;
}

function markup(element: PptxElement, animatesFill?: boolean): string {
	return renderToStaticMarkup(
		renderVectorShape(element, true, '#C9C9C9', 0, '#000000', animatesFill),
	);
}

const LINEAR = {
	fillMode: 'gradient',
	fillColor: '#BDBDBD',
	fillGradientAngle: 90,
	fillGradientStops: [
		{ color: '#C9C9C9', position: 39 },
		{ color: '#B1B1B1', position: 71 },
	],
};

describe('renderVectorShape freeform gradient fill', () => {
	it('paints the path with an SVG paint server, not the representative solid', () => {
		const html = markup(freeform(LINEAR));
		expect(html).toContain('<linearGradient');
		expect(html).toContain('id="pptx-grad-ppt_slides_slide3_xml-shape-9"');
		expect(html).toContain('fill="url(#pptx-grad-ppt_slides_slide3_xml-shape-9)"');
		// The averaged stand-in colour must not be painted as a flat fill.
		expect(html).not.toContain('fill="#BDBDBD"');
	});

	it('emits every gradient stop at its authored offset', () => {
		const html = markup(freeform(LINEAR));
		expect(html).toContain('offset="0.39"');
		expect(html).toContain('stop-color="#C9C9C9"');
		expect(html).toContain('offset="0.71"');
		expect(html).toContain('stop-color="#B1B1B1"');
	});

	it('preserves a fully transparent stop instead of painting it opaque', () => {
		const html = markup(
			freeform({
				fillMode: 'gradient',
				fillColor: '#808080',
				fillGradientStops: [
					{ color: '#000000', position: 0 },
					{ color: '#FFFFFF', position: 100, opacity: 0 },
				],
			}),
		);
		expect(html).toContain('stop-opacity="0"');
	});

	it('emits a radialGradient for a path gradient', () => {
		const html = markup(
			freeform({
				...LINEAR,
				fillGradientType: 'radial',
				fillGradientPathType: 'circle',
				fillGradientFillToRect: { l: 0, t: 0, r: 1, b: 1 },
			}),
		);
		expect(html).toContain('<radialGradient');
		expect(html).toContain('cx="0"');
		expect(html).toContain('cy="0"');
	});

	it('leaves a solid freeform fill exactly as it was', () => {
		const html = markup(freeform({ fillMode: 'solid', fillColor: '#C9C9C9' }));
		expect(html).not.toContain('linearGradient');
		expect(html.toLowerCase()).toContain('fill="#c9c9c9"');
	});

	it('yields to a p:animClr fill animation (keyframes own the paint)', () => {
		const html = markup(freeform(LINEAR), true);
		expect(html).toContain('fill="inherit"');
		expect(html).not.toContain('<linearGradient');
	});
});
