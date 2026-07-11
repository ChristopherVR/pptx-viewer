import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * EditorState is a runes class (`.svelte.ts`); this suite is named
 * `.svelte.test.ts` so the module is compiled with the runes runtime. The
 * test body itself drives the class imperatively and reads its reactive
 * getters synchronously (no `$effect` needed to observe a committed value).
 */

function shape(id: string, over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 0,
		text: 'hi',
		...over,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[], notes = ''): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements, notes };
}

function make(current = 0, save = vi.fn(async () => new Uint8Array([1, 2, 3]))) {
	const onChange = vi.fn();
	const handler = { save } as unknown as PptxHandler;
	const editor = new EditorState({
		getCurrent: () => current,
		getHandler: () => handler,
		onChange,
	});
	editor.editable = true;
	return { editor, onChange, save };
}

describe('editorState selection + geometry', () => {
	it('setSlides seeds the working slides and resets selection/history/dirty', () => {
		const { editor } = make();
		editor.selectedElementId = 'x';
		editor.dirty = true;
		editor.setSlides([slide('a', [shape('e1')])]);
		expect(editor.slides).toHaveLength(1);
		expect(editor.selectedElementId).toBeNull();
		expect(editor.dirty).toBeFalsy();
		expect(editor.canUndo).toBeFalsy();
	});

	it('resolves the selected element against the current slide', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1'), shape('e2')])]);
		editor.select('e2');
		expect(editor.selectedElement?.id).toBe('e2');
	});

	it('patchGeometry updates position without recording history', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.patchGeometry('e1', { x: 1, y: 2, width: 3, height: 4, rotation: 5 });
		expect(editor.slides[0].elements[0].x).toBe(1);
		expect(editor.canUndo).toBeFalsy();
	});
});

describe('editorState history-tracked mutations', () => {
	it('deleteSelected removes, marks dirty, fires onChange, and is undoable', () => {
		const { editor, onChange } = make();
		editor.setSlides([slide('a', [shape('e1'), shape('e2')])]);
		editor.select('e1');
		editor.deleteSelected();
		expect(editor.slides[0].elements.map((e) => e.id)).toStrictEqual(['e2']);
		expect(editor.dirty).toBeTruthy();
		expect(editor.canUndo).toBeTruthy();
		expect(onChange).toHaveBeenCalledWith();

		editor.undo();
		expect(editor.slides[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'e2']);
		expect(editor.canRedo).toBeTruthy();

		editor.redo();
		expect(editor.slides[0].elements.map((e) => e.id)).toStrictEqual(['e2']);
	});

	it('deleteSelected is a no-op when not editable', () => {
		const { editor } = make();
		editor.editable = false;
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.select('e1');
		editor.deleteSelected();
		expect(editor.slides[0].elements).toHaveLength(1);
		expect(editor.canUndo).toBeFalsy();
	});

	it('duplicateSelected appends an offset copy and selects it', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.select('e1');
		const newId = editor.duplicateSelected();
		expect(newId).toBeTruthy();
		expect(editor.slides[0].elements).toHaveLength(2);
		expect(editor.selectedElementId).toBe(newId);
	});

	it('coalesces rapid nudges into a single history entry', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.select('e1');
		editor.nudgeSelected(1, 0);
		editor.nudgeSelected(1, 0);
		editor.nudgeSelected(0, 1);
		expect(editor.slides[0].elements[0].x).toBe(12);
		expect(editor.slides[0].elements[0].y).toBe(21);
		// One coalesced entry: a single undo returns to the pre-nudge position.
		editor.undo();
		expect(editor.slides[0].elements[0].x).toBe(10);
		expect(editor.slides[0].elements[0].y).toBe(20);
	});

	it('commitInlineText rewrites the element text', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1', { text: 'old' })])]);
		editor.commitInlineText('e1', 'new text');
		expect((editor.slides[0].elements[0] as { text?: string }).text).toBe('new text');
		expect(editor.canUndo).toBeTruthy();
	});

	it('commitNotes writes plain-text notes and is a no-op when unchanged', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [], 'first')]);
		editor.commitNotes('second');
		expect(editor.slides[0].notes).toBe('second');
		expect(editor.canUndo).toBeTruthy();

		const undoable = editor.canUndo;
		editor.commitNotes('second');
		// No new history entry for an unchanged commit.
		expect(editor.canUndo).toBe(undoable);
	});
});

describe('editorState format / insert / z-order operations', () => {
	it('applyElementPatch merges a style patch with history', () => {
		const { editor, onChange } = make();
		editor.setSlides([slide('a', [shape('e1', { textStyle: { fontSize: 18 } })])]);
		editor.applyElementPatch('e1', { textStyle: { fontSize: 18, bold: true } });
		expect(
			(editor.slides[0].elements[0] as { textStyle?: { bold?: boolean } }).textStyle?.bold,
		).toBeTruthy();
		expect(editor.canUndo).toBeTruthy();
		expect(onChange).toHaveBeenCalledWith();
		editor.undo();
		expect(
			(editor.slides[0].elements[0] as { textStyle?: { bold?: boolean } }).textStyle?.bold,
		).toBeUndefined();
	});

	it('applyElementPatch is a no-op when not editable or id missing', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.applyElementPatch('missing', { x: 999 });
		expect(editor.canUndo).toBeFalsy();
		editor.editable = false;
		editor.applyElementPatch('e1', { x: 999 });
		expect(editor.slides[0].elements[0].x).toBe(10);
	});

	it('patchSelected applies to the current selection', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.select('e1');
		editor.patchSelected({ x: 42 });
		expect(editor.slides[0].elements[0].x).toBe(42);
	});

	it('insertElement assigns a fresh id, appends, selects, and is undoable', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		const newId = editor.insertElement(shape('', { id: '' }));
		expect(newId).toBeTruthy();
		expect(editor.slides[0].elements).toHaveLength(2);
		expect(editor.selectedElementId).toBe(newId);
		editor.undo();
		expect(editor.slides[0].elements).toHaveLength(1);
	});

	it('reorderSelected moves the selection through the paint order (undoable)', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1'), shape('e2'), shape('e3')])]);
		editor.select('e1');
		editor.reorderSelected('front');
		expect(editor.slides[0].elements.map((e) => e.id)).toStrictEqual(['e2', 'e3', 'e1']);
		editor.undo();
		expect(editor.slides[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'e2', 'e3']);
	});

	it('reorderSelected is a no-op with no selection', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1'), shape('e2')])]);
		editor.reorderSelected('back');
		expect(editor.canUndo).toBeFalsy();
	});
});

describe('editorState save', () => {
	it('serializes the current slides via the handler and clears dirty', async () => {
		const { editor, save } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		editor.select('e1');
		editor.deleteSelected();
		expect(editor.dirty).toBeTruthy();

		const bytes = await editor.save();
		expect(bytes).toStrictEqual(new Uint8Array([1, 2, 3]));
		expect(save).toHaveBeenCalledWith(editor.slides);
		expect(editor.dirty).toBeFalsy();
	});

	it('rejects when no presentation is loaded', async () => {
		const editor = new EditorState({
			getCurrent: () => 0,
			getHandler: () => null,
		});
		await expect(editor.save()).rejects.toThrow('No presentation is loaded.');
	});
});
