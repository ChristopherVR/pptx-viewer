// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { smartArtNodeAtPoint, stripEditLayerMarkers } from './smartart-3d-edit-layer';

describe('stripEditLayerMarkers', () => {
	it('removes element markers but keeps node ids', () => {
		const root = document.createElement('div');
		root.innerHTML =
			'<div data-element-id="e1" data-testid="smartart-list" role="img" aria-label="Diagram">' +
			'<svg><g data-smartart-node-id="n1"><text>A</text></g></svg></div>';
		root.setAttribute('data-element-id', 'e1');
		stripEditLayerMarkers(root);
		expect(root.hasAttribute('data-element-id')).toBeFalsy();
		expect(root.querySelector('[data-element-id], [data-testid], [role], [aria-label]')).toBeNull();
		expect(root.querySelector('[data-smartart-node-id="n1"]')).not.toBeNull();
	});
});

describe('smartArtNodeAtPoint', () => {
	function node(id: string, left: number, top: number, width: number, height: number): Element {
		const el = document.createElement('div');
		el.setAttribute('data-smartart-node-id', id);
		el.getBoundingClientRect = () =>
			({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
		return el;
	}

	it('finds the smallest node box under the point, whatever its pointer-events', () => {
		const root = document.createElement('div');
		root.append(
			node('outer', 0, 0, 200, 200),
			node('inner', 50, 50, 40, 40),
			node('far', 300, 0, 50, 50),
		);
		expect(smartArtNodeAtPoint(root, 60, 60)?.getAttribute('data-smartart-node-id')).toBe('inner');
		expect(smartArtNodeAtPoint(root, 10, 10)?.getAttribute('data-smartart-node-id')).toBe('outer');
		expect(smartArtNodeAtPoint(root, 250, 250)).toBeNull();
	});
});
