import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import FieldMenu from './FieldMenu.svelte';

/**
 * FieldMenu tests: the native `<select>` Insert > Field dropdown (slide
 * number / date-time / header / footer), resolved via the shared
 * `substituteFieldText` helper.
 */

const CANVAS: CanvasSize = { width: 960, height: 540 };

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(current = 2, editable = true): EditorState {
	const editor = new EditorState({ getCurrent: () => current, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([
		{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		{ id: 's2', rId: 'rId2', slideNumber: 2, elements: [] },
		{ id: 's3', rId: 'rId3', slideNumber: 3, elements: [] },
	]);
	return editor;
}

function mountMenu(editor: EditorState): HTMLSelectElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(FieldMenu, { target, props: { editor, canvasSize: CANVAS } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const select = target.querySelector('select');
	if (!select) {
		throw new Error('select not found');
	}
	return select;
}

describe('fieldMenu', () => {
	it('is disabled when the editor is not editable', () => {
		expect(mountMenu(makeEditor(0, false)).disabled).toBeTruthy();
	});

	it('inserts a slide-number field resolved against the current (1-based) slide', () => {
		const editor = makeEditor(2);
		const select = mountMenu(editor);

		select.value = 'slidenum';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const el = editor.slides[2]?.elements[0];
		expect(el?.type).toBe('shape');
		if (el?.type === 'shape') {
			expect(el.text).toBe('3');
			expect(el.textSegments?.[0]?.fieldType).toBe('slidenum');
		}
		expect(select.value).toBe('');
	});
});
