import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import InkDrawingOverlay from './InkDrawingOverlay.svelte';

/**
 * InkDrawingOverlay tests: the live in-progress stroke preview must render
 * the same plain-path / pressure-circle / tilt-nib decision
 * (`ink.liveStrokeView`, from the shared `buildLiveInkStrokeView`) a
 * committed stroke gets from `InkView.svelte`, while the pointer is still
 * down (before `commitStroke`). Named `*.svelte.test.ts` per the repo
 * convention for mounting a Svelte 5 component with `mount()`.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function mountOverlay(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(InkDrawingOverlay, {
		target,
		props: { ink: editor.inkOps, canvasSize: { width: 960, height: 540 } },
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('inkDrawingOverlay', () => {
	it('renders nothing while idle (no live preview)', () => {
		const editor = makeEditor();
		const target = mountOverlay(editor);
		flushSync();
		expect(target.querySelector('svg')).toBeNull();
	});

	it('renders calligraphic nib marks while a stroke with a genuine tilt lean is in progress', () => {
		const editor = makeEditor();
		editor.inkOps.setTool('pen');
		const target = mountOverlay(editor);
		editor.inkOps.previewStroke([
			{ x: 0, y: 0, tiltX: 0, tiltY: 0 },
			{ x: 10, y: 0, tiltX: 30, tiltY: -15 },
		]);
		flushSync();
		expect(target.querySelectorAll('ellipse').length).toBeGreaterThan(0);
		expect(target.querySelector('path')).toBeNull();
	});

	it('renders a plain path while the pointer reports no tilt', () => {
		const editor = makeEditor();
		editor.inkOps.setTool('pen');
		const target = mountOverlay(editor);
		editor.inkOps.previewStroke([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		]);
		flushSync();
		expect(target.querySelectorAll('ellipse')).toHaveLength(0);
		expect(target.querySelector('path')).not.toBeNull();
	});

	it('clears the live preview once the stroke is committed', () => {
		const editor = makeEditor();
		editor.inkOps.setTool('pen');
		const target = mountOverlay(editor);
		editor.inkOps.previewStroke([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		]);
		flushSync();
		expect(target.querySelector('svg')).not.toBeNull();

		editor.inkOps.commitStroke([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		]);
		flushSync();
		expect(target.querySelector('svg')).toBeNull();
	});
});
