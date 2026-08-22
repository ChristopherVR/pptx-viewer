import { describe, expect, it } from 'vitest';

import type { PptxSmartArtNode } from '../types';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';

const NODE: PptxSmartArtNode = { id: 'n1', text: 'Hello' };
const CTX = styleContext('flat');

function box(shape: Parameters<typeof presetBoxNode>[0]['shape']) {
	return presetBoxNode({
		key: 'k',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		node: NODE,
		index: 0,
		total: 1,
		palette: ['#4472C4'],
		style: 'flat',
		ctx: CTX,
		shape,
		fallbackKind: 'rect',
	});
}

describe('presetBoxNode', () => {
	it('builds a rect when there is no shape override (fallback wins)', () => {
		const node = box(undefined);
		expect(node.kind).toBe('rect');
	});

	it('builds a circle inscribed in the box for an ellipse override', () => {
		const node = box({ presetGeometry: 'ellipse' });
		expect(node.kind).toBe('circle');
		if (node.kind === 'circle') {
			expect(node.cx).toBe(60); // 10 + 100/2
			expect(node.cy).toBe(45); // 20 + 50/2
			expect(node.r).toBe(25); // min(100,50)/2
		}
	});

	it('builds a polygon for a chevron override, bounded by the box', () => {
		const node = box({ presetGeometry: 'chevron' });
		expect(node.kind).toBe('polygon');
	});

	it('applies an adjLst-driven corner radius to a roundRect override', () => {
		const node = box({ presetGeometry: 'roundRect', adjustments: [{ index: 1, value: 0.4 }] });
		expect(node.kind).toBe('rect');
		if (node.kind === 'rect') {
			expect(node.rx).toBe(20); // min(100,50) * 0.4
		}
	});

	it('a plain "rect" preset keeps the default (non-adjLst) corner radius heuristic', () => {
		const node = box({ presetGeometry: 'rect' });
		const fallback = box(undefined);
		expect(node.kind).toBe('rect');
		if (node.kind === 'rect' && fallback.kind === 'rect') {
			expect(node.rx).toBe(fallback.rx);
		}
	});
});
