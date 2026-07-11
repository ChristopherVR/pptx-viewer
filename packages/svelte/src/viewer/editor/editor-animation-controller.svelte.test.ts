import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * `EditorAnimationController` drives `EditorState` (a runes class), so this
 * suite is named `.svelte.test.ts` to compile with the runes runtime, like
 * `editor-state.svelte.test.ts`.
 */

function slide(id: string, over: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements: [{ type: 'shape', id: 'e1', x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
		...over,
	} as PptxSlide;
}

function make(current = 0) {
	const handler = {} as unknown as PptxHandler;
	const editor = new EditorState({ getCurrent: () => current, getHandler: () => handler });
	editor.editable = true;
	return editor;
}

describe('editorAnimationController', () => {
	it('addAnimation appends a PptxSlide.animations entry for the selected element, undoably', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.select('e1');
		editor.animationOps.addAnimation('entrance', 'fadeIn');
		expect(editor.slides[0].animations).toStrictEqual([
			expect.objectContaining({ elementId: 'e1', entrance: 'fadeIn' }),
		]);
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		expect(editor.slides[0].animations ?? []).toHaveLength(0);
	});

	it('addAnimation sets one bucket without clobbering the others already on the element', () => {
		const editor = make();
		editor.setSlides([
			slide('a', {
				animations: [{ elementId: 'e1', entrance: 'fadeIn', durationMs: 500, order: 0 }],
			}),
		]);
		editor.select('e1');
		editor.animationOps.addAnimation('exit', 'fadeOut');
		expect(editor.slides[0].animations).toStrictEqual([
			expect.objectContaining({ elementId: 'e1', entrance: 'fadeIn', exit: 'fadeOut' }),
		]);
	});

	it('addAnimation is a no-op with no selection', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.animationOps.addAnimation('entrance', 'fadeIn');
		expect(editor.slides[0].animations ?? []).toHaveLength(0);
		expect(editor.canUndo).toBeFalsy();
	});

	it('removeAnimation drops the selected element entry, undoably', () => {
		const editor = make();
		editor.setSlides([
			slide('a', {
				animations: [{ elementId: 'e1', entrance: 'fadeIn', durationMs: 500, order: 0 }],
			}),
		]);
		editor.select('e1');
		editor.animationOps.removeAnimation();
		expect(editor.slides[0].animations).toHaveLength(0);
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		expect(editor.slides[0].animations).toHaveLength(1);
	});

	it('removeAnimation is a no-op when the selected element has no animation entry', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.select('e1');
		editor.animationOps.removeAnimation();
		expect(editor.canUndo).toBeFalsy();
	});

	it('is a no-op when not editable', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.select('e1');
		editor.editable = false;
		editor.animationOps.addAnimation('entrance', 'fadeIn');
		expect(editor.slides[0].animations ?? []).toHaveLength(0);
	});
});
