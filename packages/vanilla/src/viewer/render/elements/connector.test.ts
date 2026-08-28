import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderConnectorElement } from './connector';

/**
 * The connector wrapper is `pointer-events: none`, so an empty bounding box
 * never swallows clicks meant for the shapes it spans. That also left the LINE
 * unclickable: no pointer route reached a connector at all, and its arrowhead
 * controls could only be opened from the inspector's Elements list. These tests
 * pin the transparent stroke that opts hit testing back in.
 */
function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'r1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement: (element, zIndex) => registry.resolve(element.type)(element, zIndex, context),
	};
	return context;
}

function connector(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'connector',
		id: 'conn-1',
		x: 10,
		y: 20,
		width: 120,
		height: 60,
		shapeType: 'straightConnector1',
		shapeStyle: { strokeColor: '#333333', strokeWidth: 1 },
		...overrides,
	} as PptxElement;
}

function hitPath(element: PptxElement): SVGPathElement {
	const wrapper = renderConnectorElement(element, 0, makeContext()) as HTMLElement;
	const path = wrapper.querySelector<SVGPathElement>('.pptxv-connector-hit');
	if (!path) {
		throw new Error('connector has no hit target');
	}
	return path;
}

describe('connector pointer hit target', () => {
	it('runs a transparent, finger-wide stroke along a hairline connector', () => {
		const path = hitPath(connector());

		expect(path.getAttribute('stroke')).toBe('transparent');
		expect(path.getAttribute('stroke-width')).toBe('14');
		expect(path.getAttribute('d')).toBe('M0,0 L120,60');
		expect(path.style.pointerEvents).toBe('stroke');
	});

	it('scales the target with a thick line', () => {
		expect(
			hitPath(connector({ shapeStyle: { strokeWidth: 10 } })).getAttribute('stroke-width'),
		).toBe('30');
	});

	it('follows the routed path when the connector bends', () => {
		const path = hitPath(connector({ shapeType: 'bentConnector3' }));

		expect(path.getAttribute('d')).toBe(
			path.parentElement?.querySelector('path:not(.pptxv-connector-hit)')?.getAttribute('d'),
		);
	});

	it('mirrors the endpoints of a flipped connector so the target follows the ink', () => {
		expect(hitPath(connector({ flipHorizontal: true })).getAttribute('d')).toBe('M120,0 L0,60');
	});

	it('resolves a press on the line to the connector, not the background', () => {
		const path = hitPath(connector());

		expect(path.closest('[data-element-id]')?.getAttribute('data-element-id')).toBe('conn-1');
	});
});
