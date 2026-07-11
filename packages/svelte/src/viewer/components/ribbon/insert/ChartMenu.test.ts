import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ChartMenu from './ChartMenu.svelte';

/**
 * ChartMenu tests: the native `<select>` Insert > Chart dropdown. Selecting
 * an entry inserts a chart element immediately (undoable, selected), and the
 * select resets to its placeholder so the same entry can be picked again.
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
	const instance = mount(ChartMenu, { target, props: { editor, canvasSize: CANVAS } });
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

describe('chartMenu', () => {
	it('is disabled when the editor is not editable', () => {
		const select = mountMenu(makeEditor(false));
		expect(select.disabled).toBeTruthy();
	});

	it('lists every shared insert-chart type as an option', () => {
		const select = mountMenu(makeEditor());
		const values = Array.from(select.options).map((o) => o.value);
		expect(values).toContain('bar');
		expect(values).toContain('pie');
	});

	it('inserts a chart element, selects it, and resets the select', () => {
		const editor = makeEditor();
		const select = mountMenu(editor);

		select.value = 'pie';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect(editor.slides[0]?.elements).toHaveLength(1);
		expect(editor.slides[0]?.elements[0]?.type).toBe('chart');
		expect(editor.selectedElementId).toBe(editor.slides[0]?.elements[0]?.id);
		expect(select.value).toBe('');
	});
});
