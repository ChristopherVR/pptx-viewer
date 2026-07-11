import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { reorderElement } from './editor-zorder';

function el(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' } as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId-s', slideNumber: 1, elements };
}

function ids(slides: PptxSlide[]): string[] {
	return slides[0].elements.map((e) => e.id);
}

describe('editor-zorder reorderElement', () => {
	const base = [slide([el('a'), el('b'), el('c')])];

	it('brings an element to the front (end of array)', () => {
		expect(ids(reorderElement(base, 0, 'a', 'front'))).toStrictEqual(['b', 'c', 'a']);
	});

	it('sends an element to the back (start of array)', () => {
		expect(ids(reorderElement(base, 0, 'c', 'back'))).toStrictEqual(['c', 'a', 'b']);
	});

	it('moves one step forward and backward', () => {
		expect(ids(reorderElement(base, 0, 'a', 'forward'))).toStrictEqual(['b', 'a', 'c']);
		expect(ids(reorderElement(base, 0, 'c', 'backward'))).toStrictEqual(['a', 'c', 'b']);
	});

	it('leaves other slides untouched by reference', () => {
		const two = [slide([el('a'), el('b')]), slide([el('x')])];
		const next = reorderElement(two, 0, 'a', 'front');
		expect(next[1]).toBe(two[1]);
	});
});
