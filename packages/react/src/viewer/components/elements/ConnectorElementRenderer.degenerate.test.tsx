import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { ConnectorElementRenderer } from './ConnectorElementRenderer';
import type { ConnectorRendererProps } from './element-renderer-types';

/**
 * issue #132 - a vertical connector rendered as a slant with bar-shaped ends.
 *
 * The reporter's deck draws its elbows out of three separate straight `line`
 * connectors, each authored with one extent at zero (`<a:ext cx="0" cy="..."/>`
 * for the verticals). React used to pad such a connector's WRAPPER out to
 * `MIN_ELEMENT_SIZE` (12px) so it stayed grabbable, while the SVG kept the
 * authored extent clamped only to 1. Under `preserveAspectRatio="none"` that
 * mapped one user unit onto twelve device pixels: the line tilted by the full
 * pad width over its length, and its round `a:headEnd`/`a:tailEnd` markers -
 * sized in `strokeWidth` units and therefore subject to the same transform -
 * stretched into horizontal bars. PowerPoint draws a plumb line with round
 * dots.
 *
 * Fixed two ways at once: the nested `<svg>` now sizes itself (width, height,
 * viewBox) to the SAME authored-extent-clamped-to-1 numbers, so the mapping
 * stays 1:1 and nothing distorts, matching what the other four bindings
 * already did. And the WRAPPER keeps the true authored extent (0 for a
 * degenerate axis) instead of padding to `MIN_ELEMENT_SIZE`: that padding had
 * made a degenerate connector measurably taller/wider than PowerPoint paints
 * it, which a cross-binding render-parity fixture caught (the other four
 * bindings never padded their wrapper this way). Grabbability comes from the
 * connector's own widened hit stroke, not from the wrapper's box.
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

function render(el: PptxElement, isSelected = false): string {
	const props = {
		el,
		isSelected,
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
	it('themes the selection halo without recoloring authored strokes or endpoint markers', () => {
		const markup = render(verticalConnector(), true);
		expect(markup).toContain('stroke="var(--pptx-selection-outline-color, #3b82f6)"');
		expect(markup).toContain('stroke-opacity="0.35"');
		expect(markup).toContain('stroke="#595959"');
		expect(markup).toContain('fill="#595959"');
	});

	it('maps the SVG viewBox 1:1 onto its own size, without inflating the wrapper', () => {
		const markup = render(verticalConnector());
		expect(markup).toContain('viewBox="0 0 1 145"');
		expect(markup).toContain('width:0px');
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

	it('floors the SVG the same way for a zero-height horizontal connector', () => {
		const el = { ...verticalConnector(), width: 400, height: 0 } as PptxElement;
		const markup = render(el);
		expect(markup).toContain('viewBox="0 0 400 1"');
		expect(markup).toContain('height:0px');
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
