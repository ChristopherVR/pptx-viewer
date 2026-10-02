import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import type { EditorController } from '../editor/editor-controller.svelte';
import { EditorState } from '../editor/editor-state.svelte';
import { PresentationLoader } from './presentation-loader.svelte';
import { useViewerEffects } from './viewer-effects.svelte';
import { ViewerState } from './viewer-state.svelte';

const shape = {
	id: 'shape-1',
	type: 'shape',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
} as unknown as PptxSlide['elements'][number];

/** Run `useViewerEffects` against a loader whose load "commits" on demand. */
function setup(preserve: boolean) {
	const loader = new PresentationLoader();
	const editor = new EditorState({
		getCurrent: () => 0,
		getHandler: () => ({}) as unknown as PptxHandler,
	});
	editor.editable = true;
	editor.applyRemoteSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [shape] }]);
	const slidesBefore = editor.slides;
	const viewer = new ViewerState();
	viewer.reset(1, 0);
	const onContentApplied = vi.fn();
	const cleanup = $effect.root(() => {
		useViewerEffects({
			getSource: () => undefined,
			getEditable: () => true,
			getInitialSlide: () => 0,
			getTranslator: () => ((key: string) => key) as never,
			loader,
			viewer,
			editor,
			controller: { closeInline: () => undefined } as unknown as EditorController,
			getOnload: () => undefined,
			getOnerror: () => undefined,
			getOnslidechange: () => undefined,
			preservesLiveSession: () => preserve,
			onContentApplied,
		});
	});
	flushSync();
	// After the mount-time slide sync, which clears the selection once.
	editor.select('shape-1');
	// What `PresentationLoader.load` does on commit.
	loader.slides = [{ id: 'boot', rId: 'rId9', slideNumber: 1, elements: [] }];
	loader.loadCount += 1;
	flushSync();
	return { editor, slidesBefore, onContentApplied, cleanup };
}

describe('useViewerEffects load commit over a live collaboration session', () => {
	it('keeps the room slides and selection when the load must preserve the session', () => {
		const { editor, slidesBefore, onContentApplied, cleanup } = setup(true);
		expect(editor.slides).toBe(slidesBefore);
		expect(editor.selectedElementId).toBe('shape-1');
		expect(onContentApplied).toHaveBeenCalledWith({ preserveSlides: true });
		cleanup();
	});

	it('replaces the slides for an ordinary load', () => {
		const { editor, onContentApplied, cleanup } = setup(false);
		expect(editor.slides[0]?.id).toBe('boot');
		expect(editor.selectedElementId).toBeNull();
		expect(onContentApplied).toHaveBeenCalledWith({ preserveSlides: false });
		cleanup();
	});
});
