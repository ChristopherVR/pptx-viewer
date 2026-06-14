import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getResolvedShapeClipPath, getResolvedShapeClipPathFor } from './shape-geometry';

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('getResolvedShapeClipPathFor', () => {
	it('returns undefined when no shape type is given', () => {
		expect(getResolvedShapeClipPathFor(undefined, 100, 100)).toBeUndefined();
	});

	it('produces a clip-path for a known preset geometry', () => {
		const clip = getResolvedShapeClipPathFor('triangle', 120, 80);
		expect(clip).toBeTypeOf('string');
		expect(clip).not.toBe('');
	});

	it('falls back to the static table when dimensions are non-positive', () => {
		// With width/height <= 0 the evaluator can't run; the static table still
		// resolves a triangle to a polygon clip-path.
		const clip = getResolvedShapeClipPathFor('triangle', 0, 0);
		expect(clip).toBeTypeOf('string');
	});

	it('returns a path() expression for cloud at a measured size', () => {
		const clip = getResolvedShapeClipPathFor('cloud', 200, 120);
		expect(clip).toBeTypeOf('string');
		expect(clip).toContain('path(');
	});

	it('honours adjustment values for adjustable shapes', () => {
		const clip = getResolvedShapeClipPathFor('pie', 100, 100, { adj1: 0, adj2: 90 });
		expect(clip).toBeTypeOf('string');
	});
});

describe('getResolvedShapeClipPath', () => {
	it('reads shapeType / dimensions off the element', () => {
		const clip = getResolvedShapeClipPath(shape({ shapeType: 'hexagon' }));
		expect(clip).toBeTypeOf('string');
	});

	it('returns undefined for an element without a shape type', () => {
		expect(getResolvedShapeClipPath(shape())).toBeUndefined();
	});

	it('accepts width / height overrides', () => {
		const el = shape({ shapeType: 'triangle' });
		const clip = getResolvedShapeClipPath(el, 300, 150);
		expect(clip).toBeTypeOf('string');
	});
});
