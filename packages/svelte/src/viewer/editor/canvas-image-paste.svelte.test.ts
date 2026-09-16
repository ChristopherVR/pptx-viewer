// oxlint-disable react-hooks/rules-of-hooks
import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasImagePaste } from './canvas-image-paste.svelte';

vi.mock(import('pptx-viewer-shared'), () => ({ attachEditorImagePaste: vi.fn() }));
const cleanups: (() => void)[] = [];
let detach = vi.fn();
beforeEach(() => {
	detach = vi.fn();
	vi.mocked(attachEditorImagePaste).mockReset().mockReturnValue(detach);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function setup() {
	const state = $state({
		eligible: true,
		slideId: 'slide-1',
		documentId: {},
		elements: [] as string[],
	});
	const root = document.createElement('div');
	const options: EditorImagePasteOptions = {
		getCanvas: () => root,
		getTarget: () => {
			void state.elements;
			return state.eligible
				? {
						documentId: state.documentId,
						slideId: state.slideId,
						canvasSize: { width: 960, height: 540 },
					}
				: null;
		},
		insertElement: vi.fn(),
	};
	const dispose = $effect.root(() => useCanvasImagePaste(() => root, options));
	flushSync();
	cleanups.push(dispose);
	return { state, root, options, dispose };
}

describe('useCanvasImagePaste', () => {
	it('attaches the current owner and existing insertion command', () => {
		const editor = setup();
		expect(attachEditorImagePaste).toHaveBeenCalledExactlyOnceWith(editor.root, editor.options);
	});

	it.each(['permission', 'load', 'slide'])(
		'disposes on committed %s away-and-back transitions',
		(change) => {
			const editor = setup();
			if (change === 'slide') {
				editor.state.slideId = 'slide-2';
				flushSync();
				editor.state.slideId = 'slide-1';
			} else {
				editor.state.eligible = false;
				flushSync();
				editor.state.eligible = true;
			}
			flushSync();
			expect(detach).toHaveBeenCalledTimes(2);
		},
	);

	it('does not cancel an in-flight decode on an ordinary element edit', () => {
		const editor = setup();
		editor.state.elements = ['changed'];
		flushSync();
		expect(detach).not.toHaveBeenCalled();
	});

	it('keeps readonly ownership and disposes on unmount', () => {
		const editor = setup();
		editor.state.eligible = false;
		flushSync();
		expect(attachEditorImagePaste).toHaveBeenCalledTimes(2);
		expect(vi.mocked(attachEditorImagePaste).mock.lastCall![1].getTarget()).toBeNull();
		editor.dispose();
		expect(detach).toHaveBeenCalledTimes(2);
	});
});
