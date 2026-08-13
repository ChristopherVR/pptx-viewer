import type { PptxElement, PptxHandler, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * `EditorMasterController` drives `EditorState` (a runes class), so this suite
 * is named `.svelte.test.ts` to compile with the runes runtime.
 *
 * Regression guard for View > Slide Master: the master and layout shape trees
 * were never populated by the loader, so there was nothing here to edit, and
 * selecting a layout hid the master's own artwork entirely.
 */

const MASTER_PATH = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT_PATH = 'ppt/slideLayouts/slideLayout1.xml';

function shape(id: string, x = 0): PptxElement {
	return { id, type: 'shape', x, y: 0, width: 10, height: 10 } as PptxElement;
}

function make(): EditorState {
	const handler = {} as unknown as PptxHandler;
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => handler });
	editor.editable = true;
	editor.slideMasters = [
		{
			path: MASTER_PATH,
			elements: [shape('slide-master-slideMaster1-shape-0')],
			layouts: [{ path: LAYOUT_PATH, elements: [shape('slide-layout-slideLayout1-shape-0')] }],
		} as PptxSlideMaster,
	];
	return editor;
}

describe('editorMasterController', () => {
	it('edits the master itself when no layout is selected', () => {
		const editor = make();
		editor.masterOps.enter(0, null);
		expect(editor.masterOps.activeElements()?.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
		]);

		expect(editor.masterOps.replace([shape('slide-master-slideMaster1-shape-0', 42)])).toBeTruthy();
		expect(editor.slideMasters[0].elements?.[0].x).toBe(42);
	});

	it('paints the master behind a layout and routes each edit to its own part', () => {
		const editor = make();
		editor.masterOps.enter(0, 0);
		expect(editor.masterOps.activeElements()?.map((el) => el.id)).toStrictEqual([
			'slide-master-slideMaster1-shape-0',
			'slide-layout-slideLayout1-shape-0',
		]);

		editor.masterOps.replace([
			shape('slide-master-slideMaster1-shape-0'),
			shape('slide-layout-slideLayout1-shape-0', 7),
		]);
		expect(editor.slideMasters[0].layouts?.[0].elements?.[0].x).toBe(7);
		// The master's own copy is left where it was, not pulled into the layout.
		expect(editor.slideMasters[0].elements?.[0].x).toBe(0);
		expect(editor.slideMasters[0].elements).toHaveLength(1);
	});

	it('refuses to write without a target', () => {
		const editor = make();
		expect(editor.masterOps.activeElements()).toBeNull();
		expect(editor.masterOps.replace([])).toBeFalsy();
	});
});
