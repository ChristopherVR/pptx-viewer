import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	cloneSlides,
	duplicateElementOnSlide,
	findSlideElement,
	patchElementGeometry,
	removeElement,
	updateElement,
	updateSlideNotes,
} from './editor-mutations';

function shape(id: string, over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 0,
		text: 'hi',
		...over,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[], notes = ''): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements, notes };
}

describe('editor-mutations', () => {
	it('findSlideElement resolves by id on the target slide only', () => {
		const slides = [slide('a', [shape('e1')]), slide('b', [shape('e2')])];
		expect(findSlideElement(slides, 1, 'e2')?.id).toBe('e2');
		expect(findSlideElement(slides, 0, 'e2')).toBeUndefined();
	});

	it('updateElement shallow-merges without mutating the original array', () => {
		const slides = [slide('a', [shape('e1', { text: 'old' })])];
		const next = updateElement(slides, 0, 'e1', { text: 'new' } as Partial<PptxElement>);
		expect((next[0].elements[0] as { text?: string }).text).toBe('new');
		expect((slides[0].elements[0] as { text?: string }).text).toBe('old');
		expect(next).not.toBe(slides);
	});

	it('patchElementGeometry writes x/y/width/height/rotation', () => {
		const slides = [slide('a', [shape('e1')])];
		const next = patchElementGeometry(slides, 0, 'e1', {
			x: 5,
			y: 6,
			width: 7,
			height: 8,
			rotation: 45,
		});
		const el = next[0].elements[0];
		expect([el.x, el.y, el.width, el.height, el.rotation]).toStrictEqual([5, 6, 7, 8, 45]);
	});

	it('removeElement filters the element out of the slide', () => {
		const slides = [slide('a', [shape('e1'), shape('e2')])];
		const next = removeElement(slides, 0, 'e1');
		expect(next[0].elements.map((e) => e.id)).toStrictEqual(['e2']);
	});

	it('duplicateElementOnSlide offsets the copy and gives it a fresh id', () => {
		const slides = [slide('a', [shape('e1')])];
		const result = duplicateElementOnSlide(slides, 0, 'e1');
		expect(result).not.toBeNull();
		const copy = result!.slides[0].elements[1];
		expect(copy.id).toBe(result!.newId);
		expect(copy.id).not.toBe('e1');
		expect(copy.x).toBe(30); // 10 + 20 offset
		expect(copy.y).toBe(40); // 20 + 20 offset
	});

	it('duplicateElementOnSlide returns null for a missing source', () => {
		expect(duplicateElementOnSlide([slide('a', [])], 0, 'nope')).toBeNull();
	});

	it('cloneSlides deep-copies each slide (independent snapshots)', () => {
		const slides = [slide('a', [shape('e1', { text: 'orig' })])];
		const snap = cloneSlides(slides);
		(snap[0].elements[0] as { text?: string }).text = 'mutated';
		expect((slides[0].elements[0] as { text?: string }).text).toBe('orig');
	});

	it('updateSlideNotes writes only notes and preserves other slides', () => {
		const slides = [slide('a', [], 'a-notes'), slide('b', [], 'b-notes')];
		const next = updateSlideNotes(slides, 1, 'updated');
		expect(next[0].notes).toBe('a-notes');
		expect(next[1].notes).toBe('updated');
		expect(next[0]).toBe(slides[0]);
	});
});
