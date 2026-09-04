import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { ConnectorElementRenderer } from './ConnectorElementRenderer';
import type { ConnectorRendererProps } from './element-renderer-types';

/**
 * G0 (OpenXML parity audit, D3): a connector's `flipHorizontal`/
 * `flipVertical` is baked into its path endpoints by
 * `getConnectorPathGeometry` (start/end are swapped). The wrapper `<div>`'s
 * CSS transform must therefore carry rotation only - re-applying the flip as
 * `scaleX(-1)`/`scaleY(-1)` cancels the endpoint swap back out, which is
 * exactly what happened here when the wrapper used the generic
 * `getElementTransform` (which includes flip for every other element type).
 */
function flippedBentConnector(): PptxElement {
	return {
		id: 'ppt/slides/slide1.xml-conn-1',
		type: 'connector',
		shapeType: 'bentConnector2',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		flipHorizontal: true,
		rotation: 30,
		shapeStyle: {
			strokeColor: '#000000',
			strokeWidth: 2,
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

describe('flipped connector wrapper transform', () => {
	it('carries rotation only; no scale that would cancel the endpoint flip', () => {
		const markup = render(flippedBentConnector());
		expect(markup).toContain('rotate(30deg)');
		expect(markup).not.toContain('scale');
	});

	it('omits the transform style entirely when there is no rotation', () => {
		const el = { ...flippedBentConnector(), rotation: 0 };
		const markup = render(el);
		expect(markup).not.toContain('scale');
		expect(markup).not.toContain('rotate(');
	});
});
