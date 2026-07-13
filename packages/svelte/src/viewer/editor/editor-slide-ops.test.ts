import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	deleteSlideAt,
	duplicateSlideAt,
	insertBlankSlideAfter,
	moveSlide,
} from './editor-slide-ops';

function el(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, shapeType: 'rect' } as PptxElement;
}

function slide(id: string, slideNumber: number, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber, elements };
}

describe('editor-slide-ops insertBlankSlideAfter', () => {
	it('inserts a blank slide right after the given index and renumbers', () => {
		const slides = [slide('a', 1), slide('b', 2)];
		const { slides: next, newIndex } = insertBlankSlideAfter(slides, 0);
		expect(newIndex).toBe(1);
		expect(next).toHaveLength(3);
		expect(next[1].elements).toStrictEqual([]);
		expect(next.map((s) => s.slideNumber)).toStrictEqual([1, 2, 3]);
	});

	it('clamps to appending after the last slide', () => {
		const slides = [slide('a', 1)];
		const { newIndex } = insertBlankSlideAfter(slides, 99);
		expect(newIndex).toBe(1);
	});
});

describe('editor-slide-ops duplicateSlideAt', () => {
	it('clones the slide with a fresh id, inserted right after', () => {
		const slides = [slide('a', 1, [el('e1')]), slide('b', 2)];
		const result = duplicateSlideAt(slides, 0)!;
		expect(result.newIndex).toBe(1);
		expect(result.slides).toHaveLength(3);
		expect(result.slides[1].id).not.toBe('a');
		expect(result.slides[1].elements).toHaveLength(1);
		expect(result.slides.map((s) => s.slideNumber)).toStrictEqual([1, 2, 3]);
	});

	it('returns null for an out-of-range index', () => {
		expect(duplicateSlideAt([slide('a', 1)], 5)).toBeNull();
	});
});

describe('editor-slide-ops deleteSlideAt', () => {
	it('removes the slide and renumbers the rest', () => {
		const slides = [slide('a', 1), slide('b', 2), slide('c', 3)];
		const result = deleteSlideAt(slides, 1)!;
		expect(result.slides.map((s) => s.id)).toStrictEqual(['a', 'c']);
		expect(result.slides.map((s) => s.slideNumber)).toStrictEqual([1, 2]);
		expect(result.newIndex).toBe(1);
	});

	it('clamps the new index when deleting the last slide', () => {
		const slides = [slide('a', 1), slide('b', 2)];
		const result = deleteSlideAt(slides, 1)!;
		expect(result.newIndex).toBe(0);
	});

	it('refuses to delete the only remaining slide', () => {
		expect(deleteSlideAt([slide('a', 1)], 0)).toBeNull();
	});
});

describe('editor-slide-ops moveSlide', () => {
	it('moves a slide to the drop target and renumbers every slide', () => {
		const result = moveSlide([slide('a', 1), slide('b', 2), slide('c', 3)], 0, 2)!;
		expect(result.map((item) => item.id)).toStrictEqual(['b', 'c', 'a']);
		expect(result.map((item) => item.slideNumber)).toStrictEqual([1, 2, 3]);
	});

	it('rejects a no-op and indexes outside the deck', () => {
		const slides = [slide('a', 1), slide('b', 2)];
		expect(moveSlide(slides, 0, 0)).toBeNull();
		expect(moveSlide(slides, -1, 1)).toBeNull();
		expect(moveSlide(slides, 0, 2)).toBeNull();
	});
});
