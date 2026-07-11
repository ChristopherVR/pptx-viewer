import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * `EditorTransitionController` drives `EditorState` (a runes class), so this
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

describe('editorTransitionController', () => {
	it('applyTransition writes PptxSlide.transition on the current slide only, undoably', () => {
		const editor = make(1);
		editor.setSlides([slide('a'), slide('b')]);
		editor.transitionOps.applyTransition('fade', 700, false);
		expect(editor.slides[1].transition).toStrictEqual({ type: 'fade', durationMs: 700 });
		expect(editor.slides[0].transition).toBeUndefined();
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		expect(editor.slides[1].transition).toBeUndefined();
	});

	it('preserves other transition fields (direction, sound) not touched by the apply', () => {
		const editor = make();
		editor.setSlides([
			slide('a', { transition: { type: 'push', durationMs: 500, direction: 'l' } }),
		]);
		editor.transitionOps.applyTransition('wipe', 900, false);
		expect(editor.slides[0].transition).toStrictEqual({
			type: 'wipe',
			durationMs: 900,
			direction: 'l',
		});
	});

	it('applyToAll assigns a fresh transition to every slide', () => {
		const editor = make();
		editor.setSlides([
			slide('a', { transition: { type: 'push', durationMs: 500, direction: 'l' } }),
			slide('b'),
		]);
		editor.transitionOps.applyTransition('cut', 0, true);
		expect(editor.slides[0].transition).toStrictEqual({ type: 'cut', durationMs: 0 });
		expect(editor.slides[1].transition).toStrictEqual({ type: 'cut', durationMs: 0 });
	});

	it('clamps a negative or fractional duration to a non-negative integer millisecond value', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.transitionOps.applyTransition('fade', -12.6, false);
		expect(editor.slides[0].transition?.durationMs).toBe(0);
	});

	it('is a no-op when not editable', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.editable = false;
		editor.transitionOps.applyTransition('fade', 700, false);
		expect(editor.slides[0].transition).toBeUndefined();
		expect(editor.canUndo).toBeFalsy();
	});
});
