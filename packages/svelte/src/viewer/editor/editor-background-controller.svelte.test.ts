import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * `EditorBackgroundController` drives `EditorState` (a runes class), so this
 * suite is named `.svelte.test.ts` to compile with the runes runtime, like
 * `editor-state.svelte.test.ts`.
 */

function slide(id: string, over: Partial<PptxSlide> = {}): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], ...over };
}

function make(current = 0) {
	const handler = {} as unknown as PptxHandler;
	const editor = new EditorState({ getCurrent: () => current, getHandler: () => handler });
	editor.editable = true;
	return editor;
}

describe('editorBackgroundController', () => {
	it('setSlideBackgroundColor writes backgroundColor on the current slide, undoably', () => {
		const editor = make();
		editor.setSlides([slide('a'), slide('b')]);
		editor.backgroundOps.setSlideBackgroundColor('#112233');
		expect(editor.slides[0].backgroundColor).toBe('#112233');
		expect(editor.slides[1].backgroundColor).toBeUndefined();
		expect(editor.canUndo).toBeTruthy();
		expect(editor.dirty).toBeTruthy();

		editor.undo();
		expect(editor.slides[0].backgroundColor).toBeUndefined();
	});

	it('clearSlideBackground drops every background field on the current slide', () => {
		const editor = make();
		editor.setSlides([
			slide('a', {
				backgroundColor: '#ffffff',
				backgroundImage: 'data:image/png;base64,x',
				backgroundGradient: 'linear-gradient(#fff,#000)',
			}),
		]);
		editor.backgroundOps.clearSlideBackground();
		const s = editor.slides[0];
		expect(s.backgroundColor).toBeUndefined();
		expect(s.backgroundImage).toBeUndefined();
		expect(s.backgroundGradient).toBeUndefined();
		expect(s.backgroundPattern).toBeUndefined();
		expect(editor.canUndo).toBeTruthy();
	});

	it('setHideBackgroundGraphics(true) sets showMasterShapes: false, undoably', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.backgroundOps.setHideBackgroundGraphics(true);
		expect(editor.slides[0].showMasterShapes).toBeFalsy();
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		expect(editor.slides[0].showMasterShapes).toBeUndefined();
	});

	it('setHideBackgroundGraphics(false) sets showMasterShapes: true', () => {
		const editor = make();
		editor.setSlides([slide('a', { showMasterShapes: false })]);
		editor.backgroundOps.setHideBackgroundGraphics(false);
		expect(editor.slides[0].showMasterShapes).toBeTruthy();
	});

	it('is a no-op when not editable', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.editable = false;
		editor.backgroundOps.setSlideBackgroundColor('#000000');
		expect(editor.slides[0].backgroundColor).toBeUndefined();
		expect(editor.canUndo).toBeFalsy();
	});

	it('is a no-op when the current slide index is out of range', () => {
		const editor = make(5);
		editor.setSlides([slide('a')]);
		editor.backgroundOps.setSlideBackgroundColor('#000000');
		expect(editor.slides[0].backgroundColor).toBeUndefined();
		expect(editor.canUndo).toBeFalsy();
	});
});
