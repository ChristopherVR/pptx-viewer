import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * Wave-4 B6: the colour pickers' "Recent colours" row (`p:clrMru`).
 * `.svelte.test.ts` so the runes fields compile.
 */

function make() {
	const handler = { save: vi.fn() } as unknown as PptxHandler;
	const editor = new EditorState({
		getCurrent: () => 0,
		getHandler: () => handler,
		onChange: vi.fn(),
	});
	editor.editable = true;
	return editor;
}

describe('editorState.mruColors / recordRecentColor', () => {
	it('starts empty when the deck carries no p:clrMru', () => {
		const editor = make();
		expect(editor.mruColors).toStrictEqual([]);
	});

	it('a seeded list round-trips through the picker seed helper', () => {
		const editor = make();
		editor.presentationMetadata.setMruColorsSilently(['#112233']);
		expect(editor.mruColors).toStrictEqual(['#112233']);
	});

	it('picking a colour moves it to the front and writes it back', () => {
		const editor = make();
		editor.presentationMetadata.setMruColorsSilently(['#112233']);
		editor.recordRecentColor('#445566');
		expect(editor.mruColors[0]).toBe('#445566');
		expect(editor.mruColors).toContain('#112233');
	});

	it('re-picking an existing colour moves it to the front without duplicating it', () => {
		const editor = make();
		editor.presentationMetadata.setMruColorsSilently(['#112233', '#445566']);
		editor.recordRecentColor('#445566');
		expect(editor.mruColors).toStrictEqual(['#445566', '#112233']);
	});

	it('does not push undo history (PowerPoint does not undo the MRU row)', () => {
		const editor = make();
		editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as PptxSlide]);
		const canUndoBefore = editor.canUndo;
		editor.recordRecentColor('#abcdef');
		expect(editor.canUndo).toBe(canUndoBefore);
	});
});
