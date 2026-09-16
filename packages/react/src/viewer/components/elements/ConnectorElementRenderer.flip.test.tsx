// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { prepareExportClone } from 'pptx-viewer-shared';
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

function render(el: PptxElement, overrides: Partial<ConnectorRendererProps> = {}): string {
	const props = {
		el,
		isSelected: false,
		canInteract: false,
		showResizeHandles: false,
		showHoverBorder: false,
		selectionColorClass: 'blue-500',
		opacity: 1,
		zIndex: 3,
		...overrides,
	} as unknown as ConnectorRendererProps;
	return renderToStaticMarkup(<ConnectorElementRenderer {...props} />);
}

describe('flipped connector wrapper transform', () => {
	it.each([{ isSelected: true }, { showHoverBorder: true }])(
		'omits connector selection and hover decoration but keeps the authored path: %j',
		(state) => {
			const container = document.createElement('div');
			container.innerHTML = render(flippedBentConnector(), { canInteract: true, ...state });
			const authoredPaths = [...container.querySelectorAll('path:not([data-export-ignore])')].map(
				(path) => path.outerHTML,
			);
			expect(container.querySelector('[data-export-ignore="true"]')).not.toBeNull();
			const clone = container.cloneNode(true) as HTMLElement;
			prepareExportClone(clone);
			expect(clone.querySelector('[data-export-ignore="true"]')).toBeNull();
			expect(clone.querySelector('circle')).toBeNull();
			expect([...clone.querySelectorAll('path')].map((path) => path.outerHTML)).toStrictEqual(
				authoredPaths,
			);
			expect(clone.innerHTML).toContain('rotate(30deg)');
		},
	);

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
