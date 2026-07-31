import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ChartMenu from './ChartMenu.svelte';

/**
 * ChartMenu tests: Insert > Chart as React's split control, a "Chart type"
 * `<select>` that only stages a pending type beside a "Chart" button that
 * commits it (undoable, selected). Staging separately is what makes inserting
 * the same chart type twice in a row possible.
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

function mountMenu(editor: EditorState): { select: HTMLSelectElement; insert: HTMLButtonElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ChartMenu, { target, props: { editor, canvasSize: CANVAS } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const select = target.querySelector('select');
	const insert = target.querySelector('button');
	if (!select || !insert) {
		throw new Error('chart type select or insert button not found');
	}
	return { select, insert };
}

describe('chartMenu', () => {
	it('is disabled when the editor is not editable', () => {
		const { select, insert } = mountMenu(makeEditor(false));
		expect(select.disabled).toBeTruthy();
		expect(insert.disabled).toBeTruthy();
	});

	it('names the two controls the way every binding names them', () => {
		const { select, insert } = mountMenu(makeEditor());
		expect(select.getAttribute('aria-label')).toBe('Chart type');
		expect(insert.textContent?.trim()).toBe('Chart');
	});

	it('lists every shared insert-chart type as an option', () => {
		const { select } = mountMenu(makeEditor());
		const values = Array.from(select.options).map((o) => o.value);
		expect(values).toContain('bar');
		expect(values).toContain('pie');
	});

	it('inserts the staged chart type and selects the new element', () => {
		const editor = makeEditor();
		const { select, insert } = mountMenu(editor);

		select.value = 'pie';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		insert.click();
		flushSync();

		expect(editor.slides[0]?.elements).toHaveLength(1);
		expect(editor.slides[0]?.elements[0]?.type).toBe('chart');
		expect(editor.selectedElementId).toBe(editor.slides[0]?.elements[0]?.id);
	});

	it('inserts the same type twice without re-picking it', () => {
		const editor = makeEditor();
		const { insert } = mountMenu(editor);

		insert.click();
		flushSync();
		insert.click();
		flushSync();

		expect(editor.slides[0]?.elements).toHaveLength(2);
	});
});
