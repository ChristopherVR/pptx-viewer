import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { MIN_ELEMENT_SIZE } from '../../constants';
import { ConnectorElementRenderer } from './ConnectorElementRenderer';
import type { ConnectorRendererProps } from './element-renderer-types';

/**
 * issue #132 - a vertical connector rendered as a slant with bar-shaped ends.
 *
 * The reporter's deck draws its elbows out of three separate straight `line`
 * connectors, each authored with one extent at zero (`<a:ext cx="0" cy="..."/>`
 * for the verticals). React pads such a connector's wrapper out to
 * `MIN_ELEMENT_SIZE` so it stays grabbable, but kept the SVG `viewBox` at the
 * AUTHORED extent, clamped up to 1. Under `preserveAspectRatio="none"` that maps
 * one user unit onto twelve device pixels: the line tilted by the full pad width
 * over its length, and its round `a:headEnd`/`a:tailEnd` markers - sized in
 * `strokeWidth` units and therefore subject to the same transform - stretched
 * into horizontal bars. PowerPoint draws a plumb line with round dots.
 *
 * The viewBox now matches the padded box, so the mapping is 1:1. Geometry still
 * starts at 0, which keeps the line exactly where it was authored and hangs the
 * padding off to the right.
 *
 * The other four bindings size their `<svg>` to the same numbers they put in the
 * viewBox and were never distorted.
 */

function verticalConnector(): PptxElement {
	return {
		id: 'ppt/slides/slide25.xml-conn-1',
		type: 'connector',
		shapeType: 'line',
		x: 200,
		y: 100,
		width: 0,
		height: 145,
		shapeStyle: {
			strokeColor: '#595959',
			strokeWidth: 1,
			connectorStartArrow: 'oval',
			connectorEndArrow: 'oval',
		},
	} as unknown as PptxElement;
}

function render(el: PptxElement): string {
	const props = {
		el,
		isSelected: false,
		canInteract: false,
		showResizeHandles: false,
		showHoverBorder: false,
		selectionColorClass: 'blue-500',
		opacity: 1,
		zIndex: 3,
	} as unknown as ConnectorRendererProps;
	return renderToStaticMarkup(<ConnectorElementRenderer {...props} />);
}

describe('connector with a zero extent on one axis', () => {
	it('maps the viewBox 1:1 onto the padded wrapper box', () => {
		const markup = render(verticalConnector());
		expect(markup).toContain(`viewBox="0 0 ${MIN_ELEMENT_SIZE} 145"`);
		expect(markup).toContain(`width:${MIN_ELEMENT_SIZE}px`);
		expect(markup).toContain('height:145px');
	});

	it('draws a plumb line rather than a one-unit slant', () => {
		// `M 0 0 L 0 145`, not the old `M 0 0 L 1 145`, which the 12x scale on the
		// x axis turned into a 12px lean.
		const markup = render(verticalConnector());
		expect(markup).toContain('d="M 0 0 L 0 145"');
		expect(markup).not.toContain('L 1 145');
	});

	it('leaves a normally-sized connector untouched', () => {
		const el = { ...verticalConnector(), width: 300, height: 200 } as PptxElement;
		const markup = render(el);
		expect(markup).toContain('viewBox="0 0 300 200"');
		expect(markup).toContain('d="M 0 0 L 300 200"');
	});

	it('pads a zero-height horizontal connector the same way', () => {
		const el = { ...verticalConnector(), width: 400, height: 0 } as PptxElement;
		const markup = render(el);
		expect(markup).toContain(`viewBox="0 0 400 ${MIN_ELEMENT_SIZE}"`);
		expect(markup).toContain('d="M 0 0 L 400 0"');
	});

	it('renders connector label model font sizes as CSS pixels', () => {
		const el = {
			...verticalConnector(),
			width: 200,
			text: 'Label',
			textStyle: { fontSize: 64 },
			textSegments: [{ text: 'Label', style: { fontSize: 32 } }],
		} as PptxElement;
		const markup = render(el);
		expect(markup).toContain('font-size:64px');
		expect(markup).toContain('font-size:32px');
		expect(markup).not.toContain('font-size:64pt');
	});
});
