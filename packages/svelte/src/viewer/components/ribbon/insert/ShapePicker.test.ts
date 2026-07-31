import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ShapePicker from './ShapePicker.svelte';

/**
 * ShapePicker tests: the Insert tab's "Shape type" select beside its "Shape"
 * insert button. Covers the accessible names the cross-binding ribbon
 * inventory diffs on, that the staged type is what gets inserted, and the
 * read-only gate (glyph rendering itself is covered by `shape-glyphs.test.ts`).
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

function mountPicker(editor: EditorState): {
	select: HTMLSelectElement;
	insert: HTMLButtonElement;
} {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ShapePicker, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const select = target.querySelector('select');
	const insert = target.querySelector('button');
	if (!select || !insert) {
		throw new Error('shape type select or insert button not found');
	}
	return { select, insert };
}

describe('shapePicker', () => {
	it('names the pair the way every binding names it', () => {
		const { select, insert } = mountPicker(makeEditor());
		expect(select.getAttribute('aria-label')).toBe('Shape type');
		expect(insert.textContent?.trim()).toBe('Shape');
	});

	it('inserts the staged preset type', () => {
		const editor = makeEditor();
		const { select, insert } = mountPicker(editor);

		const second = select.options[1]?.value;
		expect(second).toBeTruthy();
		select.value = second;
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		insert.click();
		flushSync();

		const inserted = editor.slides[0]?.elements[0];
		expect(inserted?.type).toBe('shape');
		expect(inserted?.type === 'shape' ? inserted.shapeType : '').toBe(second);
	});

	it('disables both controls when not editable', () => {
		const { select, insert } = mountPicker(makeEditor(false));
		expect(select.disabled).toBeTruthy();
		expect(insert.disabled).toBeTruthy();
	});
});
