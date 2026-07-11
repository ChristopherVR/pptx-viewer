import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ActionButtonMenu from './ActionButtonMenu.svelte';

/**
 * ActionButtonMenu tests: the native `<select>` Insert > Action Button
 * dropdown listing the shared 12-preset catalogue.
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

function mountMenu(editor: EditorState): HTMLSelectElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ActionButtonMenu, { target, props: { editor, canvasSize: CANVAS } });
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

describe('actionButtonMenu', () => {
	it('is disabled when the editor is not editable', () => {
		expect(mountMenu(makeEditor(false)).disabled).toBeTruthy();
	});

	it('inserts a known action-button preset, selects it, and resets the select', () => {
		const editor = makeEditor();
		const select = mountMenu(editor);

		select.value = 'actionButtonForwardNext';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const el = editor.slides[0]?.elements[0];
		expect(el?.type).toBe('shape');
		if (el?.type === 'shape') {
			expect(el.shapeType).toBe('actionButtonForwardNext');
		}
		expect(editor.selectedElementId).toBe(el?.id);
		expect(select.value).toBe('');
	});
});
