import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * The sorter's context menu can target an arbitrary right-clicked slide, not
 * only the active one. `deleteCurrentSlide` / `duplicateCurrentSlide` only
 * ever operated on `currentSlideIndex`, so a Svelte host had no way to act on
 * a non-active slide from the sorter without first selecting it. These cover
 * the new arbitrary-index variants, including the "does the active slide stay
 * the same logical slide" bookkeeping when the mutated index sits before it.
 */

function slide(id: string, hidden?: boolean): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], hidden };
}

function setup(current: number): { editor: EditorState } {
	const editor = new EditorState({ getCurrent: () => current, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([slide('a'), slide('b'), slide('c')]);
	return { editor };
}

describe('svelte slides controller: arbitrary-index operations', () => {
	it('deleteSlideAtIndex on a non-active slide keeps the active slide the same logical slide', () => {
		const { editor } = setup(1); // active slide is 'b'
		const nextIndex = editor.slidesOps.deleteSlideAtIndex(0); // delete 'a'
		expect(editor.slides.map((s) => s.id)).toStrictEqual(['b', 'c']);
		// 'b' is now at index 0; the caller should navigate there.
		expect(nextIndex).toBe(0);
	});

	it('deleteSlideAtIndex on a slide AFTER the active one leaves the active index untouched', () => {
		const { editor } = setup(0); // active slide is 'a'
		const nextIndex = editor.slidesOps.deleteSlideAtIndex(2); // delete 'c'
		expect(editor.slides.map((s) => s.id)).toStrictEqual(['a', 'b']);
		expect(nextIndex).toBe(0);
	});

	it('deleteSlideAtIndex on the active slide behaves like deleteCurrentSlide', () => {
		const { editor } = setup(1);
		const nextIndex = editor.slidesOps.deleteSlideAtIndex(1); // delete 'b' (active)
		expect(editor.slides.map((s) => s.id)).toStrictEqual(['a', 'c']);
		expect(nextIndex).toBe(1);
	});

	it('duplicateSlideAtIndex on a non-active slide before the active one shifts it forward', () => {
		const { editor } = setup(1); // active slide is 'b'
		const nextIndex = editor.slidesOps.duplicateSlideAtIndex(0); // duplicate 'a'
		expect(editor.slides.map((s) => s.id)).toHaveLength(4);
		expect(editor.slides[0]?.id).toBe('a');
		expect(editor.slides[1]?.id).not.toBe('b'); // the duplicate lands here
		expect(editor.slides[2]?.id).toBe('b');
		// 'b' moved from index 1 to index 2.
		expect(nextIndex).toBe(2);
	});

	it('duplicateSlideAtIndex on a slide after the active one leaves the active index untouched', () => {
		const { editor } = setup(0); // active slide is 'a'
		const nextIndex = editor.slidesOps.duplicateSlideAtIndex(2); // duplicate 'c'
		expect(editor.slides).toHaveLength(4);
		expect(nextIndex).toBe(0);
	});

	it('toggleSlideHidden flips only the target slide, regardless of the active index', () => {
		const { editor } = setup(1);
		editor.slidesOps.toggleSlideHidden(0);
		expect(editor.slides[0]?.hidden).toBeTruthy();
		expect(editor.slides[1]?.hidden).toBeFalsy();
		editor.slidesOps.toggleSlideHidden(0);
		expect(editor.slides[0]?.hidden).toBeFalsy();
	});

	it('every operation no-ops when not editable', () => {
		const { editor } = setup(0);
		editor.editable = false;
		expect(editor.slidesOps.deleteSlideAtIndex(0)).toBeNull();
		expect(editor.slidesOps.duplicateSlideAtIndex(0)).toBeNull();
		editor.slidesOps.toggleSlideHidden(0);
		expect(editor.slides).toHaveLength(3);
		expect(editor.slides[0]?.hidden).toBeFalsy();
	});
});
