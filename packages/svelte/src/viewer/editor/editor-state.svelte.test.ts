import type { PptxElement, PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
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

function make(
	current = 0,
	save = vi.fn(async (_slides: PptxSlide[]) => new Uint8Array([1, 2, 3])),
) {
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
		editor.select('x');
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

	it('gates inherited template elements behind template editing mode', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('layout-title'), shape('e1')])]);

		editor.select('layout-title');
		expect(editor.selectedElementId).toBeNull();
		expect(editor.slides[0].elements.map((element) => element.id)).toStrictEqual(['e1']);
		expect(editor.templateElementsBySlideId.a.map((element) => element.id)).toStrictEqual([
			'layout-title',
		]);

		editor.setTemplateEditing(true);
		editor.select('layout-title');
		expect(editor.selectedElementId).toBe('layout-title');

		editor.setTemplateEditing(false);
		expect(editor.selectedElementId).toBeNull();
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
	it('reopens an existing equation and updates its OMML in place', () => {
		const { editor } = make();
		const original = { 'm:oMath': { 'm:r': { 'm:t': 'x' } } };
		const updated = { 'm:oMath': { 'm:r': { 'm:t': '42' } } };
		editor.setSlides([
			slide('a', [
				shape('equation', { textSegments: [{ text: '[Equation]', equationXml: original }] }),
			]),
		]);
		expect(editor.equationOps.open('equation')).toBeTruthy();
		expect(editor.equationOps.omml).toStrictEqual(original);
		editor.equationOps.apply(updated);
		expect(editor.activeElements).toHaveLength(1);
		expect(editor.activeElements[0].textSegments?.[0].equationXml).toStrictEqual(updated);
		editor.undo();
		expect(editor.activeElements[0].textSegments?.[0].equationXml).toStrictEqual(original);
	});

	it('applies Format Painter once and records the target style in history', () => {
		const { editor } = make();
		editor.setSlides([
			slide('a', [
				shape('source', { shapeStyle: { fillColor: '#ff0000' } }),
				shape('target', { shapeStyle: { fillColor: '#0000ff' } }),
			]),
		]);
		editor.select('source');
		editor.formatPainter.toggle();
		expect(editor.formatPainter.active).toBeTruthy();
		expect(editor.formatPainter.applyTo('target')).toBeTruthy();
		expect(editor.formatPainter.active).toBeFalsy();
		expect(editor.selectedElement?.shapeStyle?.fillColor).toBe('#ff0000');
		editor.undo();
		expect(
			editor.activeElements.find((element) => element.id === 'target')?.shapeStyle?.fillColor,
		).toBe('#0000ff');
	});

	it('edits master layouts with history and includes masters when saving', async () => {
		const { editor, save } = make();
		const masters = [
			{
				path: 'ppt/slideMasters/slideMaster1.xml',
				elements: [shape('master-title')],
				layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', elements: [shape('layout-title')] }],
			},
		] as unknown as PptxSlideMaster[];
		editor.setSlides([slide('a', [])], masters);
		editor.masterOps.enter(0, 0);
		editor.select('layout-title');
		editor.applyElementPatch('layout-title', { x: 88 });
		expect(editor.slideMasters[0].layouts?.[0].elements?.[0].x).toBe(88);
		editor.undo();
		expect(editor.slideMasters[0].layouts?.[0].elements?.[0].x).toBe(10);
		await editor.save();
		expect(save.mock.calls[0]?.[1]).toMatchObject({ slideMasters: editor.slideMasters });
	});

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

	it('undo drops a selected id the restored snapshot no longer has (e.g. after insert)', () => {
		const { editor } = make();
		editor.setSlides([slide('a', [shape('e1')])]);
		const newId = editor.insertElement(shape('', { id: '' }));
		expect(editor.selectedElementId).toBe(newId);
		editor.undo();
		// The inserted element is gone; the ribbon should not keep it "selected".
		expect(editor.selectedElementId).toBeNull();
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

	it('persists inherited edits and restores them through history', async () => {
		const { editor, save } = make();
		editor.setSlides([slide('a', [shape('layout-title'), shape('e1')])]);
		editor.setTemplateEditing(true);
		editor.select('layout-title');
		editor.patchSelected({ x: 42 });
		expect(editor.templateElementsBySlideId.a[0].x).toBe(42);
		expect(editor.slides[0].elements[0].id).toBe('e1');

		await editor.save();
		const saved = save.mock.calls.at(-1)?.[0] as PptxSlide[];
		expect(saved[0].elements.map((element) => element.id)).toStrictEqual(['layout-title', 'e1']);
		expect(saved[0].elements[0].x).toBe(42);

		editor.undo();
		expect(editor.templateElementsBySlideId.a[0].x).toBe(10);
	});

	it('routes template grouping and clipboard operations to the inherited layer', () => {
		const { editor } = make();
		editor.setSlides([
			slide('a', [shape('layout-one'), shape('master-two', { x: 30 }), shape('e1')]),
		]);
		editor.setTemplateEditing(true);
		editor.selection.setAll(['layout-one', 'master-two']);
		editor.arrangeOps.groupSelected();
		expect(editor.templateElementsBySlideId.a).toHaveLength(1);
		expect(editor.templateElementsBySlideId.a[0].type).toBe('group');
		expect(editor.slides[0].elements.map((element) => element.id)).toStrictEqual(['e1']);

		editor.clipboardOps.copySelected();
		const pastedId = editor.clipboardOps.pasteClipboard();
		expect(pastedId).toMatch(/^(layout|master)-/);
		expect(editor.templateElementsBySlideId.a).toHaveLength(2);
	});
});
