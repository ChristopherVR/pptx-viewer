import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

const shape = {
	id: 'shape-1',
	type: 'shape',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
} as unknown as PptxSlide['elements'][number];

function makeEditor(): EditorState {
	const editor = new EditorState({
		getCurrent: () => 0,
		getHandler: () => ({}) as unknown as PptxHandler,
	});
	editor.editable = true;
	return editor;
}

describe('editorState.adoptLoadedParts', () => {
	it('keeps the live slides, selection and history while taking the load context', () => {
		const editor = makeEditor();
		const roomSlide: PptxSlide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [shape] };
		editor.applyRemoteSlides([roomSlide]);
		editor.select('shape-1');
		const nonce = editor.seedNonce;
		const slidesBefore = editor.slides;

		const bootstrapSlide: PptxSlide = { id: 'boot', rId: 'rId9', slideNumber: 1, elements: [] };
		editor.adoptLoadedParts(
			[bootstrapSlide],
			[],
			undefined,
			undefined,
			[{ id: 'sec', name: 'Section', slideIds: [] } as never],
			undefined,
			undefined,
			[],
			{ hasFooter: true, footerText: 'From bootstrap' },
		);

		expect(editor.slides).toBe(slidesBefore);
		expect(editor.slides[0]?.id).toBe('s1');
		expect(editor.selectedElementId).toBe('shape-1');
		expect(editor.seedNonce).toBe(nonce);
		expect(editor.headerFooter.footerText).toBe('From bootstrap');
		expect(editor.sections).toHaveLength(1);
	});

	it('setSlides still resets the editing session for a deck the user opened', () => {
		const editor = makeEditor();
		editor.applyRemoteSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [shape] }]);
		editor.select('shape-1');
		const nonce = editor.seedNonce;

		editor.setSlides([{ id: 's2', rId: 'rId2', slideNumber: 1, elements: [] }]);

		expect(editor.slides[0]?.id).toBe('s2');
		expect(editor.selectedElementId).toBeNull();
		expect(editor.seedNonce).toBe(nonce + 1);
	});
});
