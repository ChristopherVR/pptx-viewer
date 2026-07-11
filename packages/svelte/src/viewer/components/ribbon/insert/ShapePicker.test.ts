import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ShapePicker from './ShapePicker.svelte';

/**
 * ShapePicker tests: the trigger + popup-grid shape gallery extracted from
 * `InsertTab.svelte`. Covers the open/close toggle and that picking a preset
 * inserts a `shape` element and closes the popup (the glyph-rendering logic
 * itself is covered by `shape-glyphs.test.ts`).
 */

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

function mountPicker(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ShapePicker, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('shapePicker', () => {
	it('opens the grid on trigger click and inserts the chosen preset', () => {
		const editor = makeEditor();
		const target = mountPicker(editor);

		target.querySelector('button')?.click();
		flushSync();
		const presetButtons = target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
		expect(presetButtons.length).toBeGreaterThan(0);

		presetButtons[0]?.click();
		flushSync();

		expect(editor.slides[0]?.elements[0]?.type).toBe('shape');
		expect(target.querySelector('[role="menu"]')).toBeNull();
	});

	it('disables the trigger when not editable', () => {
		const target = mountPicker(makeEditor(false));
		expect(target.querySelector('button')?.hasAttribute('disabled')).toBeTruthy();
	});
});
