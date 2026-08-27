import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { ERASER_HIT_RADIUS, findEraserHitElementId } from './ink-eraser-hit-test';

function ink(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return {
		id,
		type: 'ink',
		x,
		y,
		width,
		height,
		inkPaths: ['M0,0 L1,1'],
	} as PptxElement;
}

function contentPart(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return { id, type: 'contentPart', x, y, width, height } as PptxElement;
}

function shape(id: string, x: number, y: number, width: number, height: number): PptxElement {
	return { id, type: 'shape', x, y, width, height } as PptxElement;
}

describe('findEraserHitElementId', () => {
	it('finds an ink element directly under the point', () => {
		const elements = [ink('a', 0, 0, 100, 50)];
		expect(findEraserHitElementId(elements, { x: 50, y: 25 })).toBe('a');
	});

	it('finds a contentPart element (ink reloaded from a saved file)', () => {
		const elements = [contentPart('a', 0, 0, 100, 50)];
		expect(findEraserHitElementId(elements, { x: 50, y: 25 })).toBe('a');
	});

	it('ignores non-ink elements', () => {
		const elements = [shape('a', 0, 0, 100, 50)];
		expect(findEraserHitElementId(elements, { x: 50, y: 25 })).toBeUndefined();
	});

	it('returns the top-most match when strokes overlap', () => {
		const elements = [ink('bottom', 0, 0, 100, 50), ink('top', 0, 0, 100, 50)];
		expect(findEraserHitElementId(elements, { x: 50, y: 25 })).toBe('top');
	});

	it('hits just outside the box within the default tolerance radius', () => {
		const elements = [ink('a', 10, 10, 20, 20)];
		expect(findEraserHitElementId(elements, { x: 10 - ERASER_HIT_RADIUS + 1, y: 15 })).toBe('a');
	});

	it('misses beyond the tolerance radius', () => {
		const elements = [ink('a', 10, 10, 20, 20)];
		expect(
			findEraserHitElementId(elements, { x: 10 - ERASER_HIT_RADIUS - 1, y: 15 }),
		).toBeUndefined();
	});

	it('respects a caller-supplied hit radius', () => {
		const elements = [ink('a', 10, 10, 20, 20)];
		expect(findEraserHitElementId(elements, { x: 5, y: 15 }, 0)).toBeUndefined();
	});

	it('returns undefined for an empty element list', () => {
		expect(findEraserHitElementId([], { x: 0, y: 0 })).toBeUndefined();
	});
});
