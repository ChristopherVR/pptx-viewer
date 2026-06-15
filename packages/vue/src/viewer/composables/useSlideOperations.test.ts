// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useSlideOperations } from './useSlideOperations';

function makeSlide(id: string, slideNumber: number): PptxSlide {
	return { id, rId: `rId${slideNumber}`, slideNumber, elements: [] };
}

function setup(initial: PptxSlide[], active = 0) {
	const slides = ref<PptxSlide[]>(initial);
	const activeSlideIndex = ref(active);
	const pushHistory = vi.fn();
	const ops = useSlideOperations({ slides, activeSlideIndex, pushHistory });
	return { slides, activeSlideIndex, pushHistory, ops };
}

describe('useSlideOperations', () => {
	describe('addSlide', () => {
		it('increases the slide count and snapshots history', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1)]);
			ops.addSlide();
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(slides.value).toHaveLength(2);
			expect(slides.value[1].elements).toStrictEqual([]);
		});

		it('inserts directly after the active slide and focuses it', () => {
			const { slides, activeSlideIndex, ops } = setup([makeSlide('a', 1), makeSlide('b', 2)], 0);
			ops.addSlide();
			expect(activeSlideIndex.value).toBe(1);
			expect(slides.value.map((s) => s.id)).toStrictEqual(['a', expect.any(String), 'b']);
		});

		it('reassigns the array reference (does not mutate in place)', () => {
			const { slides, ops } = setup([makeSlide('a', 1)]);
			const before = slides.value;
			ops.addSlide();
			expect(slides.value).not.toBe(before);
		});
	});

	describe('deleteSlide', () => {
		it('removes the slide at the index and snapshots history', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1), makeSlide('b', 2)]);
			ops.deleteSlide(0);
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(slides.value.map((s) => s.id)).toStrictEqual(['b']);
		});

		it('is a no-op when only one slide remains', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1)]);
			ops.deleteSlide(0);
			expect(pushHistory).not.toHaveBeenCalled();
			expect(slides.value).toHaveLength(1);
		});

		it('clamps the active index within bounds', () => {
			const { activeSlideIndex, ops } = setup(
				[makeSlide('a', 1), makeSlide('b', 2), makeSlide('c', 3)],
				2,
			);
			ops.deleteSlide(2);
			expect(activeSlideIndex.value).toBe(1);
		});
	});

	describe('duplicateSlide', () => {
		it('inserts a deep clone right after the source and focuses it', () => {
			const original = makeSlide('a', 1);
			original.elements = [{ type: 'shape', id: 'el1', x: 0, y: 0, width: 1, height: 1 }];
			const { slides, activeSlideIndex, pushHistory, ops } = setup([original, makeSlide('b', 2)]);
			ops.duplicateSlide(0);
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(slides.value).toHaveLength(3);
			expect(activeSlideIndex.value).toBe(1);
			const clone = slides.value[1];
			expect(clone.id).not.toBe('a');
			// Deep clone: element array + elements are fresh references.
			expect(clone.elements).not.toBe(original.elements);
			expect(clone.elements[0]).not.toBe(original.elements[0]);
			expect(clone.elements[0].id).toBe('el1');
		});

		it('is a no-op for an out-of-range index', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1)]);
			ops.duplicateSlide(5);
			expect(pushHistory).not.toHaveBeenCalled();
			expect(slides.value).toHaveLength(1);
		});
	});

	describe('moveSlide', () => {
		it('reorders slides and focuses the destination', () => {
			const { slides, activeSlideIndex, pushHistory, ops } = setup([
				makeSlide('a', 1),
				makeSlide('b', 2),
				makeSlide('c', 3),
			]);
			ops.moveSlide(0, 2);
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(slides.value.map((s) => s.id)).toStrictEqual(['b', 'c', 'a']);
			expect(activeSlideIndex.value).toBe(2);
		});

		it('is a no-op when from === to', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1), makeSlide('b', 2)]);
			ops.moveSlide(1, 1);
			expect(pushHistory).not.toHaveBeenCalled();
			expect(slides.value.map((s) => s.id)).toStrictEqual(['a', 'b']);
		});

		it('is a no-op for out-of-range indices', () => {
			const { slides, pushHistory, ops } = setup([makeSlide('a', 1), makeSlide('b', 2)]);
			ops.moveSlide(0, 9);
			expect(pushHistory).not.toHaveBeenCalled();
			expect(slides.value.map((s) => s.id)).toStrictEqual(['a', 'b']);
		});
	});
});
