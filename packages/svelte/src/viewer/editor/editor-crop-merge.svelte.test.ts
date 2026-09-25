import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildEditorContextMenuEntries, runContextMenuCommand } from './context-menu-dispatch';
import { EditorState } from './editor-state.svelte';

/**
 * Merge Shapes and on-canvas picture crop, at the editor-state level: the
 * merge replaces the sources with one freeform in one undo step, and crop mode
 * previews live, cancels with no undo step, and commits with exactly one.
 */

const RECT: PptxElement = {
	type: 'shape',
	id: 'a',
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	shapeType: 'rect',
};
const ELLIPSE: PptxElement = {
	type: 'shape',
	id: 'b',
	x: 50,
	y: 50,
	width: 100,
	height: 100,
	shapeType: 'ellipse',
};
const PICTURE = {
	type: 'picture',
	id: 'pic',
	x: 200,
	y: 100,
	width: 200,
	height: 100,
	imageData: 'data:image/png;base64,AAAA',
} as PptxElement;

function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	return editor;
}

function picture(editor: EditorState): PptxElement {
	const found = editor.elementById('pic');
	if (!found) {
		throw new Error('picture missing');
	}
	return found;
}

function key(name: string): KeyboardEvent {
	return new KeyboardEvent('keydown', { key: name, cancelable: true });
}

describe('merge shapes', () => {
	it('replaces two shapes with one custom-geometry shape as one undo step', () => {
		const editor = makeEditor([RECT, ELLIPSE]);
		editor.selection.setAll(['a', 'b']);

		expect(editor.arrangeOps.mergeSelected('union')).toBeTruthy();

		const elements = editor.activeElements;
		expect(elements).toHaveLength(1);
		expect(elements[0].type).toBe('shape');
		expect(editor.selection.ids).toStrictEqual([elements[0].id]);
		editor.undo();
		expect(editor.activeElements.map((el) => el.id)).toStrictEqual(['a', 'b']);
	});

	it('offers and runs the merge entries from the context menu', () => {
		const editor = makeEditor([RECT, ELLIPSE]);
		editor.selection.setAll(['a', 'b']);
		const ids = buildEditorContextMenuEntries({ editor }).map((entry) => entry.id);
		expect(ids).toStrictEqual(
			expect.arrayContaining([
				'merge-union',
				'merge-combine',
				'merge-fragment',
				'merge-intersect',
				'merge-subtract',
			]),
		);

		runContextMenuCommand('merge-intersect', { editor });

		expect(editor.activeElements).toHaveLength(1);
	});
});

describe('picture crop mode', () => {
	it('offers Crop for a single picture and enters crop mode from the context menu', () => {
		const editor = makeEditor([PICTURE]);
		editor.selection.set('pic');
		const ids = buildEditorContextMenuEntries({ editor }).map((entry) => entry.id);
		expect(ids).toContain('crop');

		runContextMenuCommand('crop', { editor });

		expect(editor.cropOps.active).toBeTruthy();
	});

	it('escape restores the picture and leaves no undo step', () => {
		const editor = makeEditor([PICTURE]);
		editor.selection.set('pic');
		editor.cropOps.enter();
		editor.cropOps.preview({
			x: 220,
			y: 100,
			width: 180,
			height: 100,
			cropLeft: 0.1,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		expect(picture(editor).x).toBe(220);

		expect(editor.cropOps.handleKey(key('Escape'))).toBeTruthy();

		expect(editor.cropOps.active).toBeFalsy();
		expect(picture(editor).x).toBe(200);
		expect(editor.canUndo).toBeFalsy();
		// Escape was consumed by crop mode, so the selection is untouched.
		expect(editor.selection.ids).toStrictEqual(['pic']);
	});

	it('enter commits with exactly one undo step that restores the pre-crop picture', () => {
		const editor = makeEditor([PICTURE]);
		editor.selection.set('pic');
		editor.cropOps.enter();
		editor.cropOps.preview({
			x: 220,
			y: 100,
			width: 180,
			height: 100,
			cropLeft: 0.1,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});
		editor.cropOps.preview({
			x: 240,
			y: 100,
			width: 160,
			height: 100,
			cropLeft: 0.2,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0,
		});

		expect(editor.cropOps.handleKey(key('Enter'))).toBeTruthy();

		expect(editor.cropOps.active).toBeFalsy();
		expect(picture(editor).cropLeft).toBeCloseTo(0.2);
		expect(editor.canUndo).toBeTruthy();
		editor.undo();
		expect(picture(editor).x).toBe(200);
		expect(picture(editor).cropLeft ?? 0).toBe(0);
		expect(editor.canUndo).toBeFalsy();
	});

	it('commits when the selection moves off the picture', () => {
		const editor = makeEditor([PICTURE, RECT]);
		editor.selection.set('pic');
		editor.cropOps.enter();
		editor.cropOps.preview({
			x: 200,
			y: 100,
			width: 200,
			height: 80,
			cropLeft: 0,
			cropTop: 0,
			cropRight: 0,
			cropBottom: 0.2,
		});
		editor.selection.set('a');

		editor.cropOps.syncContext(editor.selection.ids, 0);

		expect(editor.cropOps.active).toBeFalsy();
		expect(editor.canUndo).toBeTruthy();
	});

	it('does not enter crop mode for a shape', () => {
		const editor = makeEditor([RECT]);
		editor.selection.set('a');

		expect(editor.cropOps.enter()).toBeFalsy();
	});
});
