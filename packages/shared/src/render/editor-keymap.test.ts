import { describe, expect, it } from 'vitest';

import {
	editorNudgeDelta,
	isEditorTextInputTarget,
	mapEditorKey,
	NUDGE_LARGE,
	NUDGE_SMALL,
} from './editor-keymap';
import type { EditorKeyGuard, EditorKeyInput } from './editor-keymap';

/** A key press with the modifiers the test cares about and nothing else. */
function press(key: string, modifiers: Partial<EditorKeyInput> = {}): EditorKeyInput {
	return { key, ...modifiers };
}

const SELECTED: Partial<EditorKeyGuard> = { hasSelection: true };

describe('nudge steps', () => {
	it('is one slide pixel bare and ten with shift', () => {
		expect(NUDGE_SMALL).toBe(1);
		expect(NUDGE_LARGE).toBe(10);
	});

	it('maps each arrow key to a delta on one axis', () => {
		expect(editorNudgeDelta('ArrowLeft', false)).toStrictEqual({ dx: -1, dy: 0 });
		expect(editorNudgeDelta('ArrowRight', false)).toStrictEqual({ dx: 1, dy: 0 });
		expect(editorNudgeDelta('ArrowUp', false)).toStrictEqual({ dx: 0, dy: -1 });
		expect(editorNudgeDelta('ArrowDown', true)).toStrictEqual({ dx: 0, dy: 10 });
		expect(editorNudgeDelta('Enter', false)).toBeNull();
	});
});

describe('mapEditorKey guards', () => {
	it('does nothing while presenting or on a read-only host', () => {
		expect(mapEditorKey(press('Delete'), { ...SELECTED, isPresenting: true }).action).toBeNull();
		expect(mapEditorKey(press('Delete'), { ...SELECTED, canEdit: false }).action).toBeNull();
	});

	it('still resolves Escape while inline-editing, so there is always a way out', () => {
		expect(mapEditorKey(press('Escape'), { isEditingText: true }).action).toBe('escape');
	});

	it('suppresses shortcuts while typing, drawing, or focused in a field', () => {
		for (const guard of [
			{ isEditingText: true },
			{ isDrawing: true },
			{ isTextInputTarget: true },
		]) {
			expect(
				mapEditorKey(press('d', { ctrlKey: true }), { ...SELECTED, ...guard }).action,
			).toBeNull();
		}
	});
});

describe('mapEditorKey clipboard and history', () => {
	it('resolves the Ctrl chords', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true }), SELECTED).action).toBe('copy');
		expect(mapEditorKey(press('x', { metaKey: true }), SELECTED).action).toBe('cut');
		expect(mapEditorKey(press('v', { ctrlKey: true })).action).toBe('paste');
		expect(mapEditorKey(press('d', { ctrlKey: true }), SELECTED).action).toBe('duplicate');
		expect(mapEditorKey(press('z', { ctrlKey: true })).action).toBe('undo');
		expect(mapEditorKey(press('z', { ctrlKey: true, shiftKey: true })).action).toBe('redo');
		expect(mapEditorKey(press('y', { ctrlKey: true })).action).toBe('redo');
		expect(mapEditorKey(press('a', { ctrlKey: true })).action).toBe('selectAll');
	});

	it('gates the selection-only chords but not paste, undo or select-all', () => {
		expect(mapEditorKey(press('c', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('x', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('d', { ctrlKey: true })).action).toBeNull();
		expect(mapEditorKey(press('v', { ctrlKey: true })).action).toBe('paste');
		expect(mapEditorKey(press('z', { ctrlKey: true })).action).toBe('undo');
		expect(mapEditorKey(press('a', { ctrlKey: true })).action).toBe('selectAll');
	});

	it('ignores a chord that also holds Alt (an AltGr composition, not a shortcut)', () => {
		expect(mapEditorKey(press('d', { ctrlKey: true, altKey: true }), SELECTED).action).toBeNull();
	});
});

describe('mapEditorKey grouping', () => {
	it('maps Ctrl+G to group and Ctrl+Shift+G to ungroup', () => {
		expect(mapEditorKey(press('g', { ctrlKey: true }), SELECTED).action).toBe('group');
		expect(mapEditorKey(press('g', { ctrlKey: true, shiftKey: true }), SELECTED).action).toBe(
			'ungroup',
		);
	});

	it('needs a selection', () => {
		expect(mapEditorKey(press('g', { ctrlKey: true })).action).toBeNull();
	});
});

describe('mapEditorKey deletion, nudge and paging', () => {
	it('deletes on Delete and Backspace only with a selection', () => {
		expect(mapEditorKey(press('Delete'), SELECTED).action).toBe('delete');
		expect(mapEditorKey(press('Backspace'), SELECTED).action).toBe('delete');
		expect(mapEditorKey(press('Delete')).action).toBeNull();
	});

	it('nudges the selection by one slide pixel, ten with shift', () => {
		expect(mapEditorKey(press('ArrowRight'), SELECTED)).toStrictEqual({
			action: 'nudge',
			dx: 1,
			dy: 0,
		});
		expect(mapEditorKey(press('ArrowUp', { shiftKey: true }), SELECTED)).toStrictEqual({
			action: 'nudge',
			dx: 0,
			dy: -10,
		});
	});

	it('pages the deck with the horizontal arrows when nothing is selected', () => {
		expect(mapEditorKey(press('ArrowLeft')).action).toBe('prevSlide');
		expect(mapEditorKey(press('ArrowRight')).action).toBe('nextSlide');
	});

	it('never pages while an element is selected: the arrows nudge instead', () => {
		expect(mapEditorKey(press('ArrowLeft'), SELECTED).action).toBe('nudge');
		expect(mapEditorKey(press('ArrowUp'), SELECTED).action).toBe('nudge');
	});
});

describe('mapEditorKey help panel', () => {
	it('opens the shortcut reference on a bare "?", which carries Shift on most layouts', () => {
		expect(mapEditorKey(press('?', { shiftKey: true })).action).toBe('toggleShortcuts');
		expect(mapEditorKey(press('?')).action).toBe('toggleShortcuts');
	});

	it('leaves Ctrl+? alone', () => {
		expect(mapEditorKey(press('?', { ctrlKey: true })).action).toBeNull();
	});
});

describe('isEditorTextInputTarget', () => {
	it('recognises form fields and contenteditable hosts', () => {
		expect(isEditorTextInputTarget({ tagName: 'INPUT' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'TEXTAREA' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'SELECT' })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'DIV', isContentEditable: true })).toBeTruthy();
		expect(isEditorTextInputTarget({ tagName: 'DIV' })).toBeFalsy();
		expect(isEditorTextInputTarget(null)).toBeFalsy();
	});
});
