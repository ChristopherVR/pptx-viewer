import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import SmartArtMenu from './SmartArtMenu.svelte';

/**
 * SmartArtMenu tests: the trigger + popup-grid Insert > SmartArt gallery
 * (mirrors the existing shape picker's dropdown-grid idiom). Picking a
 * preset inserts a `smartArt` element seeded from the preset's default items
 * and closes the popup.
 */

const CANVAS: CanvasSize = { width: 960, height: 540 };

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(editable = true): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function mountMenu(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SmartArtMenu, { target, props: { editor, canvasSize: CANVAS } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('smartArtMenu', () => {
	it('the grid is closed until the trigger is clicked', () => {
		const target = mountMenu(makeEditor());
		expect(target.querySelector('[role="menu"]')).toBeNull();

		target.querySelector('button')?.click();
		flushSync();
		expect(target.querySelector('[role="menu"]')).not.toBeNull();
	});

	it('disables the trigger when the editor is not editable', () => {
		const target = mountMenu(makeEditor(false));
		expect(target.querySelector('button')?.hasAttribute('disabled')).toBeTruthy();
	});

	it('inserts a smartArt element from a preset and closes the popup', () => {
		const editor = makeEditor();
		const target = mountMenu(editor);

		target.querySelector('button')?.click();
		flushSync();
		const presetButtons = target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
		expect(presetButtons.length).toBeGreaterThan(0);
		presetButtons[0]?.click();
		flushSync();

		const el = editor.slides[0]?.elements[0];
		expect(el?.type).toBe('smartArt');
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});
});
