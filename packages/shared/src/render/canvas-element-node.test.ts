// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { findCanvasElementNode } from './canvas-element-node';

function node(id: string): HTMLElement {
	const element = document.createElement('div');
	element.setAttribute('data-element-id', id);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('findCanvasElementNode', () => {
	it('prefers the canvas copy over a thumbnail that comes first in the DOM', () => {
		const thumbnail = node('shape-1');
		const viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		const onCanvas = node('shape-1');
		viewport.appendChild(onCanvas);
		document.body.append(thumbnail, viewport);

		expect(findCanvasElementNode(document, 'shape-1')).toBe(onCanvas);
	});

	it('falls back to any copy when there is no canvas one', () => {
		const only = node('shape-2');
		document.body.appendChild(only);
		expect(findCanvasElementNode(document, 'shape-2')).toBe(only);
	});

	it('returns null for a canvas-only lookup that finds only a thumbnail', () => {
		document.body.appendChild(node('shape-3'));
		expect(findCanvasElementNode(document, 'shape-3', { canvasOnly: true })).toBeNull();
	});

	it('handles ids that need escaping', () => {
		const viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		const tricky = node('ppt/slides/slide1.xml-shape-0');
		viewport.appendChild(tricky);
		document.body.appendChild(viewport);
		expect(findCanvasElementNode(document, 'ppt/slides/slide1.xml-shape-0')).toBe(tricky);
	});
});
